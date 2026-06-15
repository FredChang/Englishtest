using System;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Speech.Synthesis;
using Englishtest.Models;
using Englishtest.Services;

namespace Englishtest
{
    public partial class SetupWindow : Window
    {
        private readonly VocabularyService _vocabulary;

        public QuizSessionSettings Settings { get; private set; }

        public SetupWindow(VocabularyService vocabulary)
        {
            _vocabulary = vocabulary ?? throw new ArgumentNullException(nameof(vocabulary));
            InitializeComponent();
            var activeLevels = CefrLevel.All
                .Where(lvl => _vocabulary.CountByLevel.TryGetValue(lvl, out var count) && count > 0)
                .ToList();
            LevelComboBox.ItemsSource = activeLevels;
            
            var defaultIndex = activeLevels.IndexOf("B1");
            LevelComboBox.SelectedIndex = defaultIndex >= 0 ? defaultIndex : 0;
            
            PopulateVoices();
            UpdateLevelInfo();
        }

        private void PopulateVoices()
        {
            try
            {
                using (var synth = new SpeechSynthesizer())
                {
                    var voices = synth.GetInstalledVoices()
                        .Where(v => v.Enabled && v.VoiceInfo.Culture.Name.StartsWith("en"))
                        .ToList();

                    if (voices.Any())
                    {
                        VoiceComboBox.ItemsSource = voices.Select(v => new
                        {
                            DisplayName = $"{v.VoiceInfo.Name} ({v.VoiceInfo.Culture.Name})",
                            Name = v.VoiceInfo.Name
                        }).ToList();
                        VoiceComboBox.DisplayMemberPath = "DisplayName";
                        VoiceComboBox.SelectedValuePath = "Name";

                        var defaultIndex = voices.FindIndex(v => v.VoiceInfo.Name.Contains("Zira"));
                        if (defaultIndex < 0) defaultIndex = voices.FindIndex(v => v.VoiceInfo.Culture.Name == "en-US");
                        if (defaultIndex < 0) defaultIndex = 0;
                        VoiceComboBox.SelectedIndex = defaultIndex;
                    }
                }
            }
            catch { }
        }

        private void LevelComboBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (!IsLoaded)
                return;

            UpdateLevelInfo();
        }

        private void UpdateLevelInfo()
        {
            if (LevelComboBox.SelectedItem == null)
                return;

            var level = LevelComboBox.SelectedItem.ToString();
            _vocabulary.SetLevel(level);
            var available = _vocabulary.CountForCurrentLevel;
            var max = Math.Min(QuizSessionSettings.MaxQuestions, available);

            LevelPoolText.Text = available > 0
                ? $"此難度題庫共有 {available} 個單字"
                : "此難度尚無單字，請換其他等級";

            QuestionCountSlider.Maximum = Math.Max(1, max);
            if (QuestionCountSlider.Value > QuestionCountSlider.Maximum)
                QuestionCountSlider.Value = QuestionCountSlider.Maximum;

            StartButton.IsEnabled = available > 0;
            UpdateQuestionCountText();
        }

        private void QuestionCountSlider_ValueChanged(object sender, RoutedPropertyChangedEventArgs<double> e)
        {
            if (!IsLoaded)
                return;

            UpdateQuestionCountText();
        }

        private void UpdateQuestionCountText()
        {
            QuestionCountText.Text = $"{(int)QuestionCountSlider.Value} 題";
        }

        private void StartButton_Click(object sender, RoutedEventArgs e)
        {
            if (LevelComboBox.SelectedItem == null)
                return;

            var level = LevelComboBox.SelectedItem.ToString();
            var count = (int)QuestionCountSlider.Value;

            if (!_vocabulary.CanStartSession(level, count))
            {
                MessageBox.Show(this, "無法建立挑戰，請確認該難度有足夠單字。", "提示",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            var mode = ModeChoiceRadio.IsChecked == true
                ? QuizMode.MultipleChoice
                : QuizMode.Typing;

            var direction = DirEtoCRadio.IsChecked == true
                ? QuizDirection.EnglishToChinese
                : QuizDirection.ChineseToEnglish;

            // Multiple choice needs at least 4 items to generate 3 distractors
            if (mode == QuizMode.MultipleChoice)
            {
                var available = _vocabulary.CountForCurrentLevel;
                if (available < 4)
                {
                    MessageBox.Show(this, "選擇題模式至少需要 4 個單字才能產生選項，請換難度或改用輸入模式。",
                        "提示", MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }
            }

            Settings = new QuizSessionSettings
            {
                Level = level,
                QuestionCount = count,
                Mode = mode,
                Direction = direction,
                SelectedVoiceName = VoiceComboBox.SelectedValue as string
            };

            DialogResult = true;
        }

        private void GuideReadingButton_Click(object sender, RoutedEventArgs e)
        {
            var guide = new GuideReadingWindow();
            if (!guide.IsReady)
            {
                MessageBox.Show(this,
                    "找不到導讀內容（read.txt）。請確認檔案在程式目錄後重新建置。",
                    "無法開啟導讀",
                    MessageBoxButton.OK,
                    MessageBoxImage.Warning);
                return;
            }

            guide.ShowDialog();
        }
    }
}
