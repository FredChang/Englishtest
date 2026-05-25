using System.Collections.Generic;
using System.Linq;

namespace Englishtest.Models
{
    public class EtymologyResult
    {
        public List<WordRootPart> Parts { get; set; } = new List<WordRootPart>();
        public string Summary { get; set; }
        public string SourceUrl { get; set; }

        public bool HasClickableParts => Parts != null && Parts.Count >= 1;

        public bool HasSummary => !string.IsNullOrWhiteSpace(Summary);

        public bool HasAnyContent => HasClickableParts || HasSummary;
    }
}
