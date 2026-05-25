using System;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using Englishtest.Models;
using Englishtest.Services;

namespace Englishtest
{
    public partial class MainWindow : Window
    {
        private readonly VocabularyService _vocabulary;
        private readonly DictionaryLookupService _dictionary = new DictionaryLookupService();
        private readonly EtymologyLookupService _etymology = new EtymologyLookupService();
        private PronunciationService _pronunciation;
        private VocabularyItem _current;
        private WordPronunciation _currentPronunciation;
        private EtymologyResult _currentEtymology;
        private int _correctCount;
        private int _answeredCount;
        private bool _answered;
        private bool _pronunciationRevealed;
        private int _loadVersion;
        private readonly QuizSessionSettings _sessionSettings;
        private readonly QuizDirection _direction;

        public bool IsReady { get; private set; }

        public MainWindow(QuizSessionSettings settings, VocabularyService vocabulary)
        {
            _sessionSettings = settings ?? throw new ArgumentNullException(nameof(settings));
            _vocabulary = vocabulary ?? throw new ArgumentNullException(nameof(vocabulary));

            _direction = settings.Direction;

            InitializeComponent();
            _pronunciation = new PronunciationService();

            if (!_vocabulary.StartSession(_sessionSettings.Level, _sessionSettings.QuestionCount))
            {
                MessageBox.Show("無法開始挑戰，請重新選擇。", "錯誤", MessageBoxButton.OK, MessageBoxImage.Error);
                IsReady = false;
                return;
            }

            // Update UI labels based on direction
            if (_direction == QuizDirection.EnglishToChinese)
            {
                PromptLabel.Text = "請輸入中文翻譯：";
                Title = "英文單字練習App V0.4 — 英翻中";
            }
            else
            {
                PromptLabel.Text = "請輸入英文翻譯：";
                Title = "英文單字練習App V0.4 — 中翻英";
            }

            IsReady = true;
            ResetScore();
            UpdateSessionInfo();
            Loaded += (_, __) => ShowNextQuestion();
        }

        private void UpdateSessionInfo()
        {
            var current = Math.Min(_vocabulary.SessionAnswered, _vocabulary.SessionTotal);
            SessionInfoText.Text =
                $"{_vocabulary.CurrentLevel}　挑戰 {_vocabulary.SessionTotal} 題　第 {current} / {_vocabulary.SessionTotal} 題";
        }

        private void ResetScore()
        {
            _correctCount = 0;
            _answeredCount = 0;
            _answered = false;
            ScoreText.Text = $"得分：0 / {_vocabulary.SessionTotal}";
        }

        private void RestartButton_Click(object sender, RoutedEventArgs e)
        {
            var vocabulary = new VocabularyService();
            vocabulary.Load();

            var setup = new SetupWindow(vocabulary);
            if (setup.ShowDialog() != true || setup.Settings == null)
                return;

            Window newWindow;
            if (setup.Settings.Mode == Models.QuizMode.MultipleChoice)
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

        private void ShowNextQuestion()
        {
            if (_vocabulary.IsSessionComplete)
            {
                ShowSessionComplete();
                return;
            }

            _loadVersion++;
            _current = _vocabulary.GetNextQuestion();
            UpdateSessionInfo();

            if (_current == null)
            {
                ShowSessionComplete();
                return;
            }

            // Show question based on direction
            if (_direction == QuizDirection.EnglishToChinese)
                ChineseText.Text = _current.PrimaryEnglish ?? "";
            else
                ChineseText.Text = _current.Chinese ?? "";
            ResetPronunciationDisplay();

            AnswerBox.Clear();
            AnswerBox.IsEnabled = true;
            SubmitButton.IsEnabled = true;
            NextButton.IsEnabled = false;
            FeedbackPanel.Visibility = Visibility.Collapsed;
            _answered = false;
            PlayButton.IsEnabled = GetLookupWord(_current) != null;
            AnswerBox.Focus();
        }

        private void ResetPronunciationDisplay()
        {
            _pronunciationRevealed = false;
            _currentPronunciation = null;
            PhoneticPlaceholderText.Visibility = Visibility.Visible;
            PhoneticText.Visibility = Visibility.Collapsed;
            PhoneticText.Text = "";
            RootsSection.Visibility = Visibility.Collapsed;
            RootsWrapPanel.Children.Clear();
            RootHintText.Text = "";
            EtymologySummaryText.Text = "";
            EtymologySummaryText.Visibility = Visibility.Collapsed;
            _currentEtymology = null;
            DictionaryButton.IsEnabled = false;
        }

        private async void PlayButton_Click(object sender, RoutedEventArgs e)
        {
            if (_current == null)
                return;

            var lookupWord = GetLookupWord(_current);
            if (lookupWord == null)
                return;

            PlayButton.IsEnabled = false;
            try
            {
                if (_currentPronunciation == null)
                    await LoadPronunciationAsync(_current, lookupWord).ConfigureAwait(true);

                if (_currentEtymology == null)
                    _currentEtymology = await _etymology.LookupAsync(lookupWord, _current).ConfigureAwait(true);

                RevealPronunciationDisplay();
                BuildRootsPanel(_currentEtymology);
                await _pronunciation.PlayAsync(lookupWord, _currentPronunciation?.AudioUrl).ConfigureAwait(true);
            }
            catch
            {
                RevealPronunciationDisplay();
                if (_currentEtymology != null)
                    BuildRootsPanel(_currentEtymology);
                _pronunciation.Speak(lookupWord);
            }
            finally
            {
                PlayButton.IsEnabled = true;
            }
        }

        private void RevealPronunciationDisplay()
        {
            _pronunciationRevealed = true;
            PhoneticPlaceholderText.Visibility = Visibility.Collapsed;

            var phonetic = _currentPronunciation != null && !string.IsNullOrWhiteSpace(_currentPronunciation.Phonetic)
                ? _currentPronunciation.Phonetic
                : _current?.Phonetic;

            PhoneticText.Text = string.IsNullOrWhiteSpace(phonetic) ? "（暫無音標）" : phonetic;
            PhoneticText.Visibility = Visibility.Visible;
            DictionaryButton.IsEnabled = _currentPronunciation != null &&
                                        !string.IsNullOrWhiteSpace(_currentPronunciation.DictionaryUrl);
        }

        private async Task LoadPronunciationAsync(VocabularyItem item, string lookupWord)
        {
            var info = await _dictionary.LookupAsync(lookupWord).ConfigureAwait(true);

            if (!string.IsNullOrWhiteSpace(item.Phonetic))
                info.Phonetic = item.Phonetic;
            if (!string.IsNullOrWhiteSpace(item.AudioUrl))
                info.AudioUrl = item.AudioUrl;

            info.Word = item.PrimaryEnglish ?? lookupWord;
            _currentPronunciation = info;
        }

        private void BuildRootsPanel(EtymologyResult etymology)
        {
            RootsWrapPanel.Children.Clear();
            RootHintText.Text = "";
            EtymologySummaryText.Text = "";
            EtymologySummaryText.Visibility = Visibility.Collapsed;

            if (etymology == null || !etymology.HasAnyContent)
            {
                RootsSection.Visibility = Visibility.Collapsed;
                return;
            }

            RootsSection.Visibility = Visibility.Visible;

            if (etymology.HasClickableParts)
            {
                RootsTitleText.Text = _current != null && _current.HasRoots
                    ? "字根快速記憶（精選，點選查看提示）"
                    : "構詞成分（Wiktionary 詞源，點選查看提示）";
                RootsWrapPanel.Visibility = Visibility.Visible;

                foreach (var root in etymology.Parts)
                {
                if (root == null || string.IsNullOrWhiteSpace(root.Part))
                    continue;

                if (RootsWrapPanel.Children.Count > 0)
                {
                    RootsWrapPanel.Children.Add(new TextBlock
                    {
                        Text = " + ",
                        FontSize = 18,
                        FontWeight = FontWeights.Bold,
                        Foreground = new SolidColorBrush(Color.FromRgb(146, 64, 14)),
                        VerticalAlignment = VerticalAlignment.Center,
                        Margin = new Thickness(4, 0, 4, 0)
                    });
                }

                var button = new Button
                {
                    Content = root.Part,
                    Tag = root,
                    Padding = new Thickness(12, 6, 12, 6),
                    Margin = new Thickness(2),
                    FontSize = 16,
                    FontWeight = FontWeights.SemiBold,
                    Background = new SolidColorBrush(Color.FromRgb(254, 243, 199)),
                    Foreground = new SolidColorBrush(Color.FromRgb(146, 64, 14)),
                    BorderBrush = new SolidColorBrush(Color.FromRgb(251, 191, 36)),
                    BorderThickness = new Thickness(1),
                    Cursor = Cursors.Hand
                };
                    button.Click += RootPart_Click;
                    RootsWrapPanel.Children.Add(button);
                }
            }
            else
            {
                RootsTitleText.Text = "詞源說明（Wiktionary）";
                RootsWrapPanel.Visibility = Visibility.Collapsed;
            }

            if (etymology.HasSummary)
            {
                EtymologySummaryText.Text = etymology.Summary;
                EtymologySummaryText.Visibility = Visibility.Visible;
            }
        }

        private void WiktionaryLink_Click(object sender, RoutedEventArgs e)
        {
            var url = _currentEtymology?.SourceUrl;
            if (string.IsNullOrWhiteSpace(url))
                return;

            _pronunciation.OpenDictionary(url);
        }

        private void RootPart_Click(object sender, RoutedEventArgs e)
        {
            if (!(sender is Button button) || !(button.Tag is WordRootPart root))
                return;

            RootHintText.Text = string.IsNullOrWhiteSpace(root.Hint)
                ? $"「{root.Part}」"
                : $"「{root.Part}」→ {root.Hint}";

            if (!string.IsNullOrWhiteSpace(root.Part))
                _pronunciation.Speak(root.Part);
        }

        private static string GetLookupWord(VocabularyItem item)
        {
            var word = item?.PrimaryEnglish;
            if (string.IsNullOrWhiteSpace(word))
                return null;

            word = word.Trim();
            var spaceIndex = word.IndexOf(' ');
            return spaceIndex > 0 ? word.Substring(0, spaceIndex) : word;
        }

        private void DictionaryButton_Click(object sender, RoutedEventArgs e)
        {
            if (!_pronunciationRevealed)
                return;

            var url = _currentPronunciation?.DictionaryUrl;
            if (string.IsNullOrWhiteSpace(url))
                return;

            _pronunciation.OpenDictionary(url);
        }

        private void SubmitAnswer()
        {
            if (_answered || _current == null)
                return;

            bool isCorrect;
            string correctDisplay;

            if (_direction == QuizDirection.EnglishToChinese)
            {
                // English→Chinese: check user's Chinese input against the Chinese field
                var answer = (_current.Chinese ?? "").Trim();
                var userInput = (AnswerBox.Text ?? "").Trim();
                isCorrect = !string.IsNullOrEmpty(answer) && !string.IsNullOrEmpty(userInput)
                    && answer.Equals(userInput, StringComparison.OrdinalIgnoreCase);
                correctDisplay = answer;
            }
            else
            {
                isCorrect = _vocabulary.CheckAnswer(_current, AnswerBox.Text, out correctDisplay);
            }

            _answered = true;
            _answeredCount++;
            if (isCorrect)
                _correctCount++;

            ScoreText.Text = $"得分：{_correctCount} / {_vocabulary.SessionTotal}";

            var phoneticHint = "";
            if (_pronunciationRevealed)
            {
                var phonetic = PhoneticText.Text;
                if (!string.IsNullOrWhiteSpace(phonetic) && phonetic != "（暫無音標）")
                    phoneticHint = $"　音標：{phonetic}";
            }

            FeedbackPanel.Visibility = Visibility.Visible;
            if (isCorrect)
            {
                FeedbackPanel.Background = new SolidColorBrush(Color.FromRgb(220, 252, 231));
                FeedbackText.Foreground = new SolidColorBrush(Color.FromRgb(21, 128, 61));
                FeedbackText.Text = $"✓ 正確！做得很好。{phoneticHint}";
            }
            else
            {
                FeedbackPanel.Background = new SolidColorBrush(Color.FromRgb(254, 226, 226));
                FeedbackText.Foreground = new SolidColorBrush(Color.FromRgb(185, 28, 28));
                FeedbackText.Text = $"✗ 不正確。參考答案：{correctDisplay}{phoneticHint}";
            }

            AnswerBox.IsEnabled = false;
            SubmitButton.IsEnabled = false;
            NextButton.IsEnabled = true;
            NextButton.Focus();
        }

        private void SubmitButton_Click(object sender, RoutedEventArgs e)
        {
            SubmitAnswer();
        }

        private void NextButton_Click(object sender, RoutedEventArgs e)
        {
            ShowNextQuestion();
        }

        private void AnswerBox_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Enter)
            {
                if (!_answered)
                    SubmitAnswer();
                else
                    ShowNextQuestion();
                e.Handled = true;
            }
        }

        private void ShowSessionComplete()
        {
            ChineseText.Text = "挑戰完成！";
            ResetPronunciationDisplay();
            AnswerBox.IsEnabled = false;
            SubmitButton.IsEnabled = false;
            NextButton.IsEnabled = false;
            PlayButton.IsEnabled = false;

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
