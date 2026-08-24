using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Web.Script.Serialization;
using Englishtest.Models;

namespace Englishtest.Services
{
    public class SentencesService
    {
        private readonly List<SentenceItem> _allSentences = new List<SentenceItem>();
        private readonly HashSet<int> _maskedIds = new HashSet<int>();
        private readonly string _storagePath;
        private readonly Random _rand = new Random();

        public IReadOnlyList<SentenceItem> AllSentences => _allSentences;
        public IReadOnlyList<string> Categories { get; private set; } = new List<string>();
        public int TotalCount => _allSentences.Count;
        public int MaskedCount => _maskedIds.Count;
        public int UnmaskedCount => _allSentences.Count - _maskedIds.Count;

        public SentencesService()
        {
            var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            var dir = Path.Combine(appData, "Englishtest");
            if (!Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
            }
            _storagePath = Path.Combine(dir, "masked_sentences.json");
            LoadMaskedSettings();
        }

        public bool Load()
        {
            _allSentences.Clear();
            var candidates = new[]
            {
                Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "data", "sentences_1000.json"),
                Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "sentences_1000.json"),
                Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "web", "data", "sentences_1000.json"),
                Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "web", "data", "sentences_1000.json"),
                Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "data", "sentences_1000.json"),
                Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "sentences_1000.json")
            };

            string foundPath = candidates.FirstOrDefault(File.Exists);
            if (foundPath == null)
            {
                return false;
            }

            try
            {
                var json = File.ReadAllText(foundPath);
                var serializer = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };
                var list = serializer.Deserialize<List<SentenceItem>>(json);
                if (list != null && list.Count > 0)
                {
                    _allSentences.AddRange(list);
                    foreach (var item in _allSentences)
                    {
                        item.IsMasked = _maskedIds.Contains(item.id);
                    }
                    Categories = _allSentences.Select(s => s.category).Where(c => !string.IsNullOrEmpty(c)).Distinct().ToList();
                    return true;
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine("Failed to parse sentences JSON: " + ex);
            }

            return false;
        }

        private void LoadMaskedSettings()
        {
            try
            {
                if (File.Exists(_storagePath))
                {
                    var json = File.ReadAllText(_storagePath);
                    var serializer = new JavaScriptSerializer();
                    var list = serializer.Deserialize<List<int>>(json);
                    if (list != null)
                    {
                        foreach (var id in list) _maskedIds.Add(id);
                    }
                }
            }
            catch { }
        }

        public void SaveMaskedSettings()
        {
            try
            {
                var list = _maskedIds.ToList();
                var serializer = new JavaScriptSerializer();
                var json = serializer.Serialize(list);
                File.WriteAllText(_storagePath, json);
            }
            catch { }
        }

        public bool IsMasked(int id) => _maskedIds.Contains(id);

        public void ToggleMask(int id)
        {
            if (_maskedIds.Contains(id))
            {
                _maskedIds.Remove(id);
            }
            else
            {
                _maskedIds.Add(id);
            }

            var item = _allSentences.FirstOrDefault(s => s.id == id);
            if (item != null)
            {
                item.IsMasked = _maskedIds.Contains(id);
            }

            SaveMaskedSettings();
        }

        public void ResetAllMasked()
        {
            _maskedIds.Clear();
            foreach (var item in _allSentences)
            {
                item.IsMasked = false;
            }
            SaveMaskedSettings();
        }

        public List<SentenceItem> GetFiltered(string category, bool includeMasked)
        {
            return _allSentences.Where(s =>
            {
                if (!string.IsNullOrEmpty(category) && category != "全部類別" && s.category != category)
                    return false;
                if (!includeMasked && _maskedIds.Contains(s.id))
                    return false;
                return true;
            }).ToList();
        }

        public SentenceItem GetRandomNext(string category, int currentId)
        {
            var available = GetFiltered(category, includeMasked: false);
            if (available.Count == 0) return null;
            if (available.Count == 1) return available[0];

            int attempts = 0;
            SentenceItem chosen;
            do
            {
                var idx = _rand.Next(available.Count);
                chosen = available[idx];
                attempts++;
            } while (chosen.id == currentId && attempts < 10);

            return chosen;
        }
    }
}
