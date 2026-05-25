using System;
using System.Collections.Generic;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using Englishtest.Models;
using Englishtest.Services;

namespace Englishtest
{
    public partial class MultipleChoiceWindow : Window
    {
        private readonly VocabularyService _vocabulary;
        private readonly QuizSessionSettings _sessionSettings;
        private readonly QuizDirection _direction;
        private PronunciationService _pronunciation;

        private VocabularyItem _current;
        private int _correctIndex;
        private int _correctCount;
        private int _answeredCount;
        private bool _answered;

        private Button[] _optionButtons;

        // Colours
        private static readonly SolidColorBrush DefaultBg = new SolidColorBrush(Colors.White);
        private static readonly SolidColorBrush DefaultBorder = new SolidColorBrush(Color.FromRgb(203, 213, 225));
        private static readonly SolidColorBrush DefaultFg = new SolidColorBrush(Color.FromRgb(51, 65, 85));
        private static readonly SolidColorBrush CorrectBg = new SolidColorBrush(Color.FromRgb(220, 252, 231));
        private static readonly SolidColorBrush CorrectBorder = new SolidColorBrush(Color.FromRgb(34, 197, 94));
        private static readonly SolidColorBrush CorrectFg = new SolidColorBrush(Color.FromRgb(21, 128, 61));
        private static readonly SolidColorBrush WrongBg = new SolidColorBrush(Color.FromRgb(254, 226, 226));
        private static readonly SolidColorBrush WrongBorder = new SolidColorBrush(Color.FromRgb(239, 68, 68));
        private static readonly SolidColorBrush WrongFg = new SolidColorBrush(Color.FromRgb(185, 28, 28));

        public bool IsReady { get; private set; }

        public MultipleChoiceWindow(QuizSessionSettings settings, VocabularyService vocabulary)
        {
            _sessionSettings = settings ?? throw new ArgumentNullException(nameof(settings));
            _vocabulary = vocabulary ?? throw new ArgumentNullException(nameof(vocabulary));
            _direction = settings.Direction;

            InitializeComponent();
            _pronunciation = new PronunciationService();
            _optionButtons = new[] { OptionA, OptionB, OptionC, OptionD };

            if (!_vocabulary.StartSession(_sessionSettings.Level, _sessionSettings.QuestionCount))
            {
                MessageBox.Show("無法開始挑戰，請重新選擇。", "錯誤", MessageBoxButton.OK, MessageBoxImage.Error);
                IsReady = false;
                return;
            }

            IsReady = true;

            TitleText.Text = _direction == QuizDirection.ChineseToEnglish
                ? "中翻英 選擇題"
                : "英翻中 選擇題";

            PromptLabel.Text = _direction == QuizDirection.ChineseToEnglish
                ? "請選出正確的英文翻譯："
                : "請選出正確的中文翻譯：";

            ScoreText.Text = $"得分：0 / {_vocabulary.SessionTotal}";
            UpdateSessionInfo();
            Loaded += (_, __) => ShowNextQuestion();
        }

        private void UpdateSessionInfo()
        {
            var current = Math.Min(_vocabulary.SessionAnswered, _vocabulary.SessionTotal);
            SessionInfoText.Text =
                $"{_vocabulary.CurrentLevel}　挑戰 {_vocabulary.SessionTotal} 題　第 {current} / {_vocabulary.SessionTotal} 題";
        }

        private void ShowNextQuestion()
        {
            if (_vocabulary.IsSessionComplete)
            {
                ShowSessionComplete();
                return;
            }

            _current = _vocabulary.GetNextQuestion();
            UpdateSessionInfo();

            if (_current == null)
            {
                ShowSessionComplete();
                return;
            }

            _answered = false;
            FeedbackPanel.Visibility = Visibility.Collapsed;
            NextButton.IsEnabled = false;

            // Build choices
            var distractors = _vocabulary.GetDistractors(_current, 3);
            var allItems = new List<VocabularyItem> { _current };
            allItems.AddRange(distractors);

            // Shuffle all 4 options
            var rng = new Random();
            var shuffled = allItems.OrderBy(_ => rng.Next()).ToList();

            // Find the correct answer index after shuffle
            _correctIndex = shuffled.IndexOf(_current);

            // Set question text
            if (_direction == QuizDirection.ChineseToEnglish)
            {
                QuestionText.Text = _current.Chinese ?? "";
                for (int i = 0; i < _optionButtons.Length; i++)
                {
                    var item = i < shuffled.Count ? shuffled[i] : null;
                    _optionButtons[i].Content = item?.PrimaryEnglish ?? "";
                    _optionButtons[i].Visibility = item != null ? Visibility.Visible : Visibility.Collapsed;
                }
            }
            else
            {
                QuestionText.Text = _current.PrimaryEnglish ?? "";
                for (int i = 0; i < _optionButtons.Length; i++)
                {
                    var item = i < shuffled.Count ? shuffled[i] : null;
                    _optionButtons[i].Content = item?.Chinese ?? "";
                    _optionButtons[i].Visibility = item != null ? Visibility.Visible : Visibility.Collapsed;
                }
            }

            // Reset button styles
            foreach (var btn in _optionButtons)
            {
                btn.IsEnabled = true;
                btn.Background = DefaultBg;
                btn.BorderBrush = DefaultBorder;
                btn.Foreground = DefaultFg;
            }
        }

        private void Option_Click(object sender, RoutedEventArgs e)
        {
            if (_answered || _current == null)
                return;

            var button = sender as Button;
            if (button == null)
                return;

            int selectedIndex;
            if (!int.TryParse(button.Tag?.ToString(), out selectedIndex))
                return;

            _answered = true;
            _answeredCount++;

            bool isCorrect = selectedIndex == _correctIndex;
            if (isCorrect)
                _correctCount++;

            ScoreText.Text = $"得分：{_correctCount} / {_vocabulary.SessionTotal}";

            // Disable all buttons
            foreach (var btn in _optionButtons)
                btn.IsEnabled = false;

            // Highlight correct answer green
            _optionButtons[_correctIndex].Background = CorrectBg;
            _optionButtons[_correctIndex].BorderBrush = CorrectBorder;
            _optionButtons[_correctIndex].Foreground = CorrectFg;

            // If wrong, also highlight the selected one red
            if (!isCorrect)
            {
                button.Background = WrongBg;
                button.BorderBrush = WrongBorder;
                button.Foreground = WrongFg;
            }

            // Feedback
            FeedbackPanel.Visibility = Visibility.Visible;
            if (isCorrect)
            {
                FeedbackPanel.Background = CorrectBg;
                FeedbackText.Foreground = CorrectFg;
                FeedbackText.Text = "✓ 正確！做得很好。";
            }
            else
            {
                var correctDisplay = _direction == QuizDirection.ChineseToEnglish
                    ? _current.PrimaryEnglish
                    : _current.Chinese;
                FeedbackPanel.Background = WrongBg;
                FeedbackText.Foreground = WrongFg;
                FeedbackText.Text = $"✗ 不正確。正確答案：{correctDisplay}";
            }

            // Play pronunciation for the correct word
            var word = _current.PrimaryEnglish;
            if (!string.IsNullOrWhiteSpace(word))
                _pronunciation.Speak(word);

            NextButton.IsEnabled = true;
            NextButton.Focus();
        }

        private void NextButton_Click(object sender, RoutedEventArgs e)
        {
            ShowNextQuestion();
        }

        private void RestartButton_Click(object sender, RoutedEventArgs e)
        {
            var vocabulary = new VocabularyService();
            vocabulary.Load();

            var setup = new SetupWindow(vocabulary);
            if (setup.ShowDialog() != true || setup.Settings == null)
                return;

            Window newWindow;
            if (setup.Settings.Mode == QuizMode.MultipleChoice)
            {
                var mc = new MultipleChoiceWindow(setup.Settings, vocabulary);
                if (!mc.IsReady) return;
                newWindow = mc;
            }
            else
            {
                var main = new MainWindow(setup.Settings, vocabulary);
                if (!main.IsReady) return;
                newWindow = main;
            }

            _pronunciation.Dispose();
            Application.Current.ShutdownMode = ShutdownMode.OnExplicitShutdown;
            Application.Current.MainWindow = newWindow;
            newWindow.Show();
            Close();
            Application.Current.ShutdownMode = ShutdownMode.OnMainWindowClose;
        }

        private void ShowSessionComplete()
        {
            QuestionText.Text = "挑戰完成！";
            foreach (var btn in _optionButtons)
            {
                btn.IsEnabled = false;
                btn.Visibility = Visibility.Visible;
                btn.Content = "";
            }
            NextButton.IsEnabled = false;
            FeedbackPanel.Visibility = Visibility.Collapsed;

            var total = _vocabulary.SessionTotal;
            var correct = _correctCount;
            MessageBox.Show(
                $"本次共 {total} 題，答對 {correct} 題。\n得分：{correct} / {total}",
                "挑戰結束",
                MessageBoxButton.OK,
                MessageBoxImage.Information);
        }

        private void Window_Closed(object sender, EventArgs e)
        {
            _pronunciation?.Dispose();
        }
    }
}
