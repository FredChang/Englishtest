using System;

namespace Englishtest.Models
{
    public class SentenceItem
    {
        public int id { get; set; }
        public string en { get; set; }
        public string zh { get; set; }
        public string category { get; set; }

        public bool IsMasked { get; set; }
    }
}
