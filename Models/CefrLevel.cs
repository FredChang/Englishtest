using System;
using System.Linq;

namespace Englishtest.Models
{
    public static class CefrLevel
    {
        public static readonly string[] All = { "A1", "A2", "B1", "B2", "C1", "C2" };

        public static string Normalize(string level)
        {
            if (string.IsNullOrWhiteSpace(level))
                return "A1";

            var value = level.Trim().ToUpperInvariant();
            return All.Contains(value) ? value : "A1";
        }
    }
}
