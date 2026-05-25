using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using Englishtest.Models;

namespace Englishtest.Services
{
    public class EtymologyLookupService
    {
        private static readonly HttpClient Http = new HttpClient();
        private readonly Dictionary<string, EtymologyResult> _cache =
            new Dictionary<string, EtymologyResult>(StringComparer.OrdinalIgnoreCase);

        public async Task<EtymologyResult> LookupAsync(string word, VocabularyItem item = null)
        {
            if (item != null && item.HasRoots)
            {
                return new EtymologyResult
                {
                    Parts = item.Roots.Where(r => r != null && !string.IsNullOrWhiteSpace(r.Part)).ToList(),
                    SourceUrl = BuildWiktionaryUrl(word)
                };
            }

            if (string.IsNullOrWhiteSpace(word))
                return new EtymologyResult();

            var key = word.Trim().ToLowerInvariant();
            if (_cache.TryGetValue(key, out var cached))
                return cached;

            var result = new EtymologyResult
            {
                SourceUrl = BuildWiktionaryUrl(key)
            };

            try
            {
                var wikitext = await FetchEtymologyWikitextAsync(key).ConfigureAwait(false);
                if (!string.IsNullOrWhiteSpace(wikitext))
                {
                    result.Parts = ParseMorphemesFromWikitext(wikitext);
                    if (!result.HasClickableParts)
                        result.Summary = ParseProseSummary(wikitext);
                }
            }
            catch
            {
                // 離線或查無資料
            }

            _cache[key] = result;
            return result;
        }

        private static string BuildWiktionaryUrl(string word)
        {
            return "https://en.wiktionary.org/wiki/" + Uri.EscapeDataString(word.Trim());
        }

        private static async Task<string> FetchEtymologyWikitextAsync(string word)
        {
            var url = "https://en.wiktionary.org/w/api.php?action=parse&page=" +
                      Uri.EscapeDataString(word) +
                      "&prop=wikitext&formatversion=2&format=json";

            var json = await Http.GetStringAsync(url).ConfigureAwait(false);
            if (string.IsNullOrWhiteSpace(json))
                return null;

            var parsed = new JavaScriptSerializer().Deserialize<WiktionaryParseResponse>(json);
            var full = parsed?.parse?.wikitext;
            if (string.IsNullOrWhiteSpace(full))
                return null;

            var match = Regex.Match(full, @"===Etymology===\s*\n(.*?)(?=\n===)", RegexOptions.Singleline);
            return match.Success ? match.Groups[1].Value.Trim() : null;
        }

        private static List<WordRootPart> ParseMorphemesFromWikitext(string etymologySection)
        {
            var parts = new List<WordRootPart>();

            foreach (Match match in Regex.Matches(etymologySection, @"\{\{(?:ety|af)\|([^}]+)\}\}", RegexOptions.IgnoreCase))
            {
                AddTemplateParts(match.Groups[1].Value, parts);
            }

            var fromMatch = Regex.Match(
                etymologySection,
                @"From\s+(?:\{\{m\|[^|]+\|)?([^\s|}+]+)(?:\}\})?\s*\+\s*(?:\{\{m\|[^|]+\|)?([^\s|}.]+)",
                RegexOptions.IgnoreCase);
            if (fromMatch.Success)
            {
                AddUniquePart(fromMatch.Groups[1].Value, "Wiktionary：構詞成分", parts);
                AddUniquePart(fromMatch.Groups[2].Value, "Wiktionary：構詞成分", parts);
            }

            return parts;
        }

        private static void AddTemplateParts(string templateBody, List<WordRootPart> parts)
        {
            var tokens = templateBody.Split('|');
            var skippedLanguage = false;

            foreach (var raw in tokens)
            {
                var token = raw.Trim();
                if (string.IsNullOrWhiteSpace(token))
                    continue;

                if (!skippedLanguage && Regex.IsMatch(token, @"^[a-z]{2,3}(-[a-z]+)?$", RegexOptions.IgnoreCase))
                {
                    skippedLanguage = true;
                    continue;
                }

                if (token.StartsWith(":", StringComparison.Ordinal))
                    continue;
                if (token.Contains("="))
                    continue;
                if (!IsMorphemeToken(token))
                    continue;

                AddUniquePart(token, "Wiktionary 詞源／詞綴", parts);
            }
        }

        private static bool IsMorphemeToken(string token)
        {
            if (token.Length < 2 && !token.StartsWith("-", StringComparison.Ordinal))
                return false;

            return Regex.IsMatch(token, @"^[\-a-zA-Z][a-zA-Z\-]*$");
        }

        private static void AddUniquePart(string part, string hint, List<WordRootPart> parts)
        {
            part = part.Trim().Trim('}', '{', '.', ',');
            if (!IsMorphemeToken(part))
                return;

            if (parts.Any(p => string.Equals(p.Part, part, StringComparison.OrdinalIgnoreCase)))
                return;

            parts.Add(new WordRootPart { Part = part, Hint = hint });
        }

        private static string ParseProseSummary(string etymologySection)
        {
            if (string.IsNullOrWhiteSpace(etymologySection))
                return null;

            var text = etymologySection;
            text = Regex.Replace(text, @"\{\{[^}]+\}\}", " ");
            text = Regex.Replace(text, @"\[\[(?:[^\]|]+\|)?([^\]]+)\]\]", "$1");
            text = Regex.Replace(text, @"''+", "");
            text = Regex.Replace(text, @"\s+", " ").Trim();

            if (text.Length < 12)
                return null;

            return text.Length > 280 ? text.Substring(0, 277) + "…" : text;
        }

        private class WiktionaryParseResponse
        {
            public WiktionaryParse parse { get; set; }
        }

        private class WiktionaryParse
        {
            public string wikitext { get; set; }
        }
    }
}
