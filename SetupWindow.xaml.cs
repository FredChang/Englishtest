using System;
using System.IO;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Speech.Synthesis;
using System.Web.Script.Serialization;
using Englishtest.Models;
using Englishtest.Services;

namespace Englishtest
{
    public partial class SetupWindow : Window
    {
        private readonly VocabularyService _vocabulary;
        private string _selectedLevel = "B1";
        private static readonly string SettingsFilePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "user_settings.json");

        public QuizSessionSettings Settings { get; private set; }

        public SetupWindow(VocabularyService vocabulary)
        {
            _vocabulary = vocabulary ?? throw new ArgumentNullException(nameof(vocabulary));
            InitializeComponent();

            PopulateVoices();
            LoadSavedSettings();
            UpdateLevelInfo();
        }

        protected override void OnPreviewKeyDown(KeyEventArgs e)
        {
            base.OnPreviewKeyDown(e);
            if (e.Key == Key.Escape || e.Key == Key.System || e.Key == Key.Back || e.Key == Key.BrowserBack)
            {
                if (e.Key == Key.Back && e.OriginalSource is TextBox tb && !string.IsNullOrEmpty(tb.SelectedText))
                {
                    return;
                }

                e.Handled = true;
                var result = MessageBox.Show(this, "確定要退出程式嗎？", "退出確認", MessageBoxButton.YesNo, MessageBoxImage.Question);
                if (result == MessageBoxResult.Yes)
                {
                    DialogResult = false;
                    Close();
                }
            }
        }

        private string GetSelectedLevel()
        {
            if (LevelA1Radio.IsChecked == true) return "A1";
            if (LevelA2Radio.IsChecked == true) return "A2";
            if (LevelB1Radio.IsChecked == true) return "B1";
            if (LevelB2Radio.IsChecked == true) return "B2";
            if (LevelC1Radio.IsChecked == true) return "C1";
            if (LevelC2Radio.IsChecked == true) return "C2";
            return "B1";
        }

        private void SetSelectedLevel(string level)
        {
            _selectedLevel = level;
            LevelA1Radio.IsChecked = (level == "A1");
            LevelA2Radio.IsChecked = (level == "A2");
            LevelB1Radio.IsChecked = (level == "B1");
            LevelB2Radio.IsChecked = (level == "B2");
            LevelC1Radio.IsChecked = (level == "C1");
            LevelC2Radio.IsChecked = (level == "C2");
        }

        private void LevelRadio_Click(object sender, RoutedEventArgs e)
        {
            if (sender is RadioButton radio && radio.Tag != null)
            {
                _selectedLevel = radio.Tag.ToString();
                UpdateLevelInfo();
            }
        }

        private void PresetCount_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.Tag != null && int.TryParse(btn.Tag.ToString(), out int val))
            {
                QuestionCountSlider.Value = Math.Min(val, QuestionCountSlider.Maximum);
            }
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

        private void UpdateLevelInfo()
        {
            var level = GetSelectedLevel();
            _vocabulary.SetLevel(level);
            var available = _vocabulary.CountForCurrentLevel;
            var max = Math.Min(QuizSessionSettings.MaxQuestions, available);

            LevelPoolText.Text = available > 0
                ? $"「{level}」難度題庫共有 {available} 個單字"
                : $"「{level}」難度尚無單字，請切換其他等級";

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
            if (QuestionCountText != null)
                QuestionCountText.Text = $"{(int)QuestionCountSlider.Value} 題";
        }

        private void LoadSavedSettings()
        {
            try
            {
                if (File.Exists(SettingsFilePath))
                {
                    var json = File.ReadAllText(SettingsFilePath);
                    var serializer = new JavaScriptSerializer();
                    var saved = serializer.Deserialize<SavedConfig>(json);
                    if (saved != null)
                    {
                        if (!string.IsNullOrEmpty(saved.Level))
                            SetSelectedLevel(saved.Level);

                        if (saved.Mode == "Choice")
                            ModeChoiceRadio.IsChecked = true;
                        else
                            ModeTypingRadio.IsChecked = true;

                        if (saved.QuestionCount > 0)
                            QuestionCountSlider.Value = saved.QuestionCount;

                        if (!string.IsNullOrEmpty(saved.VoiceName) && VoiceComboBox.ItemsSource != null)
                            VoiceComboBox.SelectedValue = saved.VoiceName;
                        return;
                    }
                }
            }
            catch { }

            SetSelectedLevel("B1");
        }

        private void SaveUserSettings()
        {
            try
            {
                var saved = new SavedConfig
                {
                    Level = GetSelectedLevel(),
                    Mode = ModeChoiceRadio.IsChecked == true ? "Choice" : "Typing",
                    QuestionCount = (int)QuestionCountSlider.Value,
                    VoiceName = VoiceComboBox.SelectedValue as string
                };
                var serializer = new JavaScriptSerializer();
                var json = serializer.Serialize(saved);
                File.WriteAllText(SettingsFilePath, json);
            }
            catch { }
        }

        private void StartButton_Click(object sender, RoutedEventArgs e)
        {
            var level = GetSelectedLevel();
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

            SaveUserSettings();

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

        private void SentencesButton_Click(object sender, RoutedEventArgs e)
        {
            var win = new SentencesWindow();
            win.Owner = this;
            win.ShowDialog();
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

        private class SavedConfig
        {
            public string Level { get; set; }
            public string Mode { get; set; }
            public int QuestionCount { get; set; }
            public string VoiceName { get; set; }
        }
    }
}
