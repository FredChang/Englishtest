using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;

namespace Englishtest.Services
{
    public class GuideReadingContentService
    {
        private static readonly Regex SentenceSplit = new Regex(
            @"(?<=[.!?])\s+",
            RegexOptions.Compiled);

        private static readonly Regex CjkPattern = new Regex(@"[\u3400-\u9fff]", RegexOptions.Compiled);

        private Dictionary<string, string> _friendsZhMap;

        public string FullText { get; private set; }
        public IReadOnlyList<string> Segments { get; private set; } = Array.Empty<string>();
        public IReadOnlyList<string> ChineseLines { get; private set; } = Array.Empty<string>();
        public bool IsFriendsContent { get; private set; }

        public bool LoadFromDefaultPath()
        {
            IsFriendsContent = false;
            ChineseLines = Array.Empty<string>();
            var path = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "read.txt");
            return Load(path);
        }

        public bool LoadFriendsDialogue(out string sceneName)
        {
            sceneName = "";
            IsFriendsContent = true;

            var path = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "friends.txt");
            if (!File.Exists(path))
                return false;

            var content = File.ReadAllText(path);
            var scenes = content.Split(new[] { "===" }, StringSplitOptions.RemoveEmptyEntries);
            if (scenes.Length == 0)
                return false;

            var rand = new Random();
            var index = rand.Next(scenes.Length);
            var selectedScene = scenes[index].Trim();
            sceneName = $"六人行對話 - 第 {index + 1} 組";

            return LoadFriendsScene(selectedScene);
        }

        public bool Load(string path)
        {
            if (!File.Exists(path))
                return false;

            FullText = File.ReadAllText(path).Trim();
            if (string.IsNullOrEmpty(FullText))
                return false;

            Segments = SplitIntoSegments(FullText);
            return Segments.Count > 0;
        }

        private bool LoadFriendsScene(string sceneText)
        {
            EnsureFriendsZhMap();

            var english = new List<string>();
            var chinese = new List<string>();
            var blocks = sceneText.Split(
                new[] { "\r\n\r\n", "\n\n" },
                StringSplitOptions.RemoveEmptyEntries);

            foreach (var block in blocks)
            {
                var lines = block
                    .Split(new[] { "\r\n", "\n" }, StringSplitOptions.RemoveEmptyEntries)
                    .Select(l => l.Trim())
                    .Where(l => l.Length > 0)
                    .ToList();

                if (lines.Count == 0)
                    continue;

                var first = ParseFriendsLine(lines[0]);
                if (string.IsNullOrWhiteSpace(first.English))
                    continue;

                var zh = first.Chinese;
                if (string.IsNullOrWhiteSpace(zh) && lines.Count >= 2 && CjkPattern.IsMatch(lines[1]))
                    zh = lines[1];

                if (string.IsNullOrWhiteSpace(zh) && _friendsZhMap != null)
                    _friendsZhMap.TryGetValue(first.English, out zh);

                english.Add(first.English);
                chinese.Add(zh ?? "");
            }

            if (english.Count == 0)
                return false;

            FullText = sceneText;
            Segments = english;
            ChineseLines = chinese;
            return true;
        }

        private static (string English, string Chinese) ParseFriendsLine(string line)
        {
            if (string.IsNullOrWhiteSpace(line))
                return ("", "");

            var pipeIndex = line.IndexOf(" | ", StringComparison.Ordinal);
            if (pipeIndex >= 0)
            {
                return (
                    line.Substring(0, pipeIndex).Trim(),
                    line.Substring(pipeIndex + 3).Trim()
                );
            }

            return (line.Trim(), "");
        }

        private void EnsureFriendsZhMap()
        {
            if (_friendsZhMap != null)
                return;

            _friendsZhMap = new Dictionary<string, string>(StringComparer.Ordinal);
            try
            {
                var path = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "friends_zh.json");
                if (!File.Exists(path))
                    return;

                var json = File.ReadAllText(path);
                var serializer = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };
                var items = serializer.Deserialize<List<FriendsZhEntry>>(json);
                if (items == null)
                    return;

                foreach (var item in items)
                {
                    if (!string.IsNullOrWhiteSpace(item?.en) && !string.IsNullOrWhiteSpace(item?.zh))
                        _friendsZhMap[item.en] = item.zh;
                }
            }
            catch
            {
                _friendsZhMap = new Dictionary<string, string>(StringComparer.Ordinal);
            }
        }

        private static List<string> SplitIntoSegments(string text)
        {
            var segments = new List<string>();
            var paragraphs = text.Split(
                new[] { "\r\n\r\n", "\n\n" },
                StringSplitOptions.RemoveEmptyEntries);

            foreach (var paragraph in paragraphs)
            {
                var normalized = paragraph.Trim()
                    .Replace("\r\n", " ")
                    .Replace("\n", " ");

                if (string.IsNullOrWhiteSpace(normalized))
                    continue;

                foreach (var part in SentenceSplit.Split(normalized))
                {
                    var sentence = part.Trim();
                    if (sentence.Length > 0)
                        segments.Add(sentence);
                }
            }

            return segments;
        }

        private sealed class FriendsZhEntry
        {
            public string en { get; set; }
            public string zh { get; set; }
        }
    }
}
