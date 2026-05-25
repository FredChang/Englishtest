using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Web.Script.Serialization;
using Englishtest.Models;

namespace Englishtest.Services
{
    public class VocabularyService
    {
        private readonly List<VocabularyItem> _items = new List<VocabularyItem>();
        private readonly List<int> _sessionQueue = new List<int>();
        private readonly Random _random = new Random();
        private string _currentLevel = "B1";
        private int _sessionPosition;

        public string CurrentLevel => _currentLevel;

        public int CountForCurrentLevel => GetPoolIndices().Count;

        public int SessionTotal { get; private set; }

        public int SessionAnswered => _sessionPosition;

        public int SessionRemaining => Math.Max(0, SessionTotal - SessionAnswered);

        public bool IsSessionComplete => SessionTotal > 0 && _sessionPosition >= SessionTotal;

        public bool HasActiveSession => SessionTotal > 0 && !IsSessionComplete;

        public IReadOnlyDictionary<string, int> CountByLevel
        {
            get
            {
                return CefrLevel.All.ToDictionary(
                    level => level,
                    level => _items.Count(i => CefrLevel.Normalize(i.Level) == level));
            }
        }

        public void Load()
        {
            _items.Clear();
            ClearSession();

            var path = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "words.json");
            if (File.Exists(path))
            {
                var json = File.ReadAllText(path);
                var loaded = new JavaScriptSerializer().Deserialize<List<VocabularyItem>>(json);
                if (loaded != null && loaded.Count > 0)
                {
                    foreach (var item in loaded.Where(i =>
                        !string.IsNullOrWhiteSpace(i.Chinese) &&
                        i.English != null &&
                        i.English.Any(e => !string.IsNullOrWhiteSpace(e))))
                    {
                        item.Level = CefrLevel.Normalize(item.Level);
                        _items.Add(item);
                    }

                    if (_items.Count > 0)
                        return;
                }
            }

            _items.AddRange(GetDefaultVocabulary());
        }

        public void SetLevel(string level)
        {
            _currentLevel = CefrLevel.Normalize(level);
        }

        public bool CanStartSession(string level, int questionCount)
        {
            SetLevel(level);
            var pool = GetPoolIndices();
            return pool.Count > 0 && questionCount >= 1;
        }

        public bool StartSession(string level, int questionCount)
        {
            SetLevel(level);
            var pool = GetPoolIndices();
            if (pool.Count == 0)
            {
                ClearSession();
                return false;
            }

            var count = Math.Max(1, questionCount);
            count = Math.Min(count, QuizSessionSettings.MaxQuestions);
            count = Math.Min(count, pool.Count);

            var shuffled = pool.OrderBy(_ => _random.Next()).ToList();

            _sessionQueue.Clear();
            _sessionQueue.AddRange(shuffled.Take(count));
            _sessionPosition = 0;
            SessionTotal = _sessionQueue.Count;
            return SessionTotal > 0;
        }

        public VocabularyItem GetNextQuestion()
        {
            if (IsSessionComplete || _sessionQueue.Count == 0)
                return null;

            var index = _sessionQueue[_sessionPosition];
            _sessionPosition++;
            return _items[index];
        }

        public bool CheckAnswer(VocabularyItem item, string userInput, out string correctDisplay)
        {
            var answers = item?.English?
                .Where(e => !string.IsNullOrWhiteSpace(e))
                .Select(Normalize)
                .ToList() ?? new List<string>();

            correctDisplay = answers.Count > 0
                ? string.Join(" / ", answers)
                : "";

            if (answers.Count == 0 || string.IsNullOrWhiteSpace(userInput))
                return false;

            return answers.Contains(Normalize(userInput));
        }

        private void ClearSession()
        {
            _sessionQueue.Clear();
            _sessionPosition = 0;
            SessionTotal = 0;
        }

        /// <summary>
        /// Returns up to <paramref name="count"/> distractor items for multiple-choice options.
        /// Prefers items from the same level; falls back to other levels if needed.
        /// </summary>
        public List<VocabularyItem> GetDistractors(VocabularyItem correct, int count = 3)
        {
            var result = new List<VocabularyItem>();
            var usedChinese = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { Normalize(correct.Chinese) };
            var usedEnglish = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (correct.English != null)
                foreach (var e in correct.English)
                    usedEnglish.Add(Normalize(e));

            // Prefer same level, then fall back to all items
            var sameLevel = _items.Where(i => i != correct && CefrLevel.Normalize(i.Level) == _currentLevel).ToList();
            var otherLevel = _items.Where(i => i != correct && CefrLevel.Normalize(i.Level) != _currentLevel).ToList();

            var candidates = sameLevel.OrderBy(_ => _random.Next()).Concat(otherLevel.OrderBy(_ => _random.Next()));

            foreach (var item in candidates)
            {
                if (result.Count >= count)
                    break;

                var chi = Normalize(item.Chinese);
                var eng = Normalize(item.PrimaryEnglish);
                if (string.IsNullOrEmpty(chi) || string.IsNullOrEmpty(eng))
                    continue;
                if (usedChinese.Contains(chi) || usedEnglish.Contains(eng))
                    continue;

                usedChinese.Add(chi);
                usedEnglish.Add(eng);
                result.Add(item);
            }

            return result;
        }

        private List<int> GetPoolIndices()
        {
            var pool = new List<int>();
            for (var i = 0; i < _items.Count; i++)
            {
                if (CefrLevel.Normalize(_items[i].Level) == _currentLevel)
                    pool.Add(i);
            }
            return pool;
        }

        private static string Normalize(string value)
        {
            return string.IsNullOrWhiteSpace(value)
                ? ""
                : value.Trim().ToLowerInvariant();
        }

        private static IEnumerable<VocabularyItem> GetDefaultVocabulary()
        {
            return new[]
            {
                Item("A1", "蘋果", "apple"),
                Item("A1", "書", "book"),
                Item("A1", "水", "water"),
                Item("A2", "電腦", "computer"),
                Item("B1", "重要", "important"),
                Item("B2", "股票", "stock")
            };
        }

        private static VocabularyItem Item(string level, string chinese, params string[] english)
        {
            return new VocabularyItem
            {
                Level = level,
                Chinese = chinese,
                English = new List<string>(english)
            };
        }
    }
}
