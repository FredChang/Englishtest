using System.Collections.Generic;
using System.Linq;

namespace Englishtest.Models
{
    public class VocabularyItem
    {
        public string Chinese { get; set; }
        public List<string> English { get; set; }
        public string Level { get; set; }
        public string Phonetic { get; set; }
        public string AudioUrl { get; set; }
        public List<WordRootPart> Roots { get; set; }

        public bool HasRoots => Roots != null && Roots.Count > 0;

        public string PrimaryEnglish =>
            English == null ? null : English.FirstOrDefault(e => !string.IsNullOrWhiteSpace(e));
    }
}
