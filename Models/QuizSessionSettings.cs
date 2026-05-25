namespace Englishtest.Models
{
    public enum QuizMode
    {
        Typing,
        MultipleChoice
    }

    public enum QuizDirection
    {
        ChineseToEnglish,
        EnglishToChinese
    }

    public class QuizSessionSettings
    {
        public const int MaxQuestions = 30;

        public string Level { get; set; }
        public int QuestionCount { get; set; }
        public QuizMode Mode { get; set; }
        public QuizDirection Direction { get; set; }
    }
}
