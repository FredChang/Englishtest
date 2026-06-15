using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using Englishtest.Models;

namespace Englishtest.Services
{
    public class DictionaryLookupService
    {
        private static readonly HttpClient Http = new HttpClient();
        private readonly Dictionary<string, WordPronunciation> _cache =
            new Dictionary<string, WordPronunciation>(StringComparer.OrdinalIgnoreCase);

        public async Task<WordPronunciation> LookupAsync(string word)
        {
            if (string.IsNullOrWhiteSpace(word))
                return new WordPronunciation();

            var key = word.Trim().ToLowerInvariant();
            if (_cache.TryGetValue(key, out var cached))
                return cached;

            var result = new WordPronunciation
            {
                Word = word.Trim(),
                DictionaryUrl = "https://dictionary.cambridge.org/dictionary/english/" + Uri.EscapeDataString(key)
            };

            try
            {
                var url = "https://api.dictionaryapi.dev/api/v2/entries/en/" + Uri.EscapeDataString(key);
                var json = await Http.GetStringAsync(url).ConfigureAwait(false);
                if (!string.IsNullOrWhiteSpace(json))
                {
                    var entries = new JavaScriptSerializer().Deserialize<List<DictionaryApiEntry>>(json);
                    var entry = entries?.FirstOrDefault();
                    if (entry?.phonetics != null)
                    {
                        foreach (var p in entry.phonetics)
                        {
                            if (p == null)
                                continue;
                            if (string.IsNullOrWhiteSpace(result.Phonetic) && !string.IsNullOrWhiteSpace(p.text))
                                result.Phonetic = p.text;
                            if (string.IsNullOrWhiteSpace(result.AudioUrl) &&
                                !string.IsNullOrWhiteSpace(p.audio) &&
                                PronunciationService.TryCreateAudioUri(p.audio, out _))
                                result.AudioUrl = p.audio.Trim();
                        }
                    }

                    if (entry?.meanings != null)
                    {
                        foreach (var m in entry.meanings)
                        {
                            if (m?.definitions == null) continue;
                            foreach (var d in m.definitions)
                            {
                                if (d != null && !string.IsNullOrWhiteSpace(d.example))
                                {
                                    result.Example = d.example.Trim();
                                    break;
                                }
                            }
                            if (!string.IsNullOrWhiteSpace(result.Example))
                                break;
                        }
                    }
                }
            }
            catch
            {
                // 離線或查無資料時使用 words.json 內建音標
            }

            _cache[key] = result;
            return result;
        }

        private class DictionaryApiEntry
        {
            public List<DictionaryApiPhonetic> phonetics { get; set; }
            public List<DictionaryApiMeaning> meanings { get; set; }
        }

        private class DictionaryApiPhonetic
        {
            public string text { get; set; }
            public string audio { get; set; }
        }

        private class DictionaryApiMeaning
        {
            public List<DictionaryApiDefinition> definitions { get; set; }
        }

        private class DictionaryApiDefinition
        {
            public string definition { get; set; }
            public string example { get; set; }
        }
    }
}
