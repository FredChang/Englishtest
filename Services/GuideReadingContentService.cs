using System;
using System.Collections.Generic;
using System.IO;
using System.Text.RegularExpressions;

namespace Englishtest.Services
{
    public class GuideReadingContentService
    {
        private static readonly Regex SentenceSplit = new Regex(
            @"(?<=[.!?])\s+",
            RegexOptions.Compiled);

        public string FullText { get; private set; }
        public IReadOnlyList<string> Segments { get; private set; } = Array.Empty<string>();

        public bool LoadFromDefaultPath()
        {
            var path = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "read.txt");
            return Load(path);
        }

        public bool LoadFriendsDialogue(out string sceneName)
        {
            sceneName = "";
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

            FullText = selectedScene;
            Segments = SplitIntoSegments(FullText);
            return Segments.Count > 0;
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
    }
}
