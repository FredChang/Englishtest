using System;
using System.Collections.Generic;
using System.Linq;
using System.Speech.Synthesis;
using System.Windows;
using System.Windows.Controls;
using Englishtest.Services;

namespace Englishtest
{
    public partial class GuideReadingWindow : Window
    {
        private readonly GuideReadingContentService _content = new GuideReadingContentService();
        private readonly SpeechSynthesizer _synthesizer = new SpeechSynthesizer();
        private int _currentIndex;
        private bool _isPlaying;
        private bool _isPaused;
        private bool _showChinese = true;

        public bool IsReady { get; private set; }

        public GuideReadingWindow()
        {
            InitializeComponent();
            ConfigureVoice();

            if (!_content.LoadFromDefaultPath())
            {
                IsReady = false;
                return;
            }

            SegmentList.ItemsSource = BuildDisplaySegments();
            IsReady = true;
            UpdateChineseToggle();
            UpdateSpeedLabel();
            UpdateProgressText();
        }

        private IEnumerable<string> BuildDisplaySegments()
        {
            for (var i = 0; i < _content.Segments.Count; i++)
            {
                var english = _content.Segments[i];
                if (_content.IsFriendsContent && _showChinese &&
                    i < _content.ChineseLines.Count &&
                    !string.IsNullOrWhiteSpace(_content.ChineseLines[i]))
                {
                    yield return english + "\n" + _content.ChineseLines[i];
                }
                else
                {
                    yield return english;
                }
            }
        }

        private void RefreshSegmentDisplay()
        {
            var selected = SegmentList.SelectedIndex;
            SegmentList.ItemsSource = null;
            SegmentList.ItemsSource = BuildDisplaySegments().ToList();
            if (selected >= 0 && selected < SegmentList.Items.Count)
                SegmentList.SelectedIndex = selected;
        }

        private void UpdateChineseToggle()
        {
            if (!_content.IsFriendsContent)
            {
                ShowChineseButton.Visibility = Visibility.Collapsed;
                return;
            }

            ShowChineseButton.Visibility = Visibility.Visible;
            ShowChineseButton.Content = _showChinese ? "隱藏中文" : "顯示中文";
        }

        private void ShowChineseButton_Click(object sender, RoutedEventArgs e)
        {
            _showChinese = !_showChinese;
            UpdateChineseToggle();
            RefreshSegmentDisplay();
        }

        private void ConfigureVoice()
        {
            try
            {
                var voices = _synthesizer.GetInstalledVoices()
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

                    // Default selection: find Zira or first en-US
                    var defaultIndex = voices.FindIndex(v => v.VoiceInfo.Name.Contains("Zira"));
                    if (defaultIndex < 0) defaultIndex = voices.FindIndex(v => v.VoiceInfo.Culture.Name == "en-US");
                    if (defaultIndex < 0) defaultIndex = 0;

                    VoiceComboBox.SelectedIndex = defaultIndex;
                }
            }
            catch { }

            _synthesizer.SpeakCompleted += Synthesizer_SpeakCompleted;
        }

        private void VoiceComboBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (VoiceComboBox.SelectedValue is string voiceName)
            {
                try
                {
                    _synthesizer.SelectVoice(voiceName);
                }
                catch { }
            }
        }

        private void SpeedSlider_ValueChanged(object sender, RoutedPropertyChangedEventArgs<double> e)
        {
            if (!IsLoaded)
                return;

            ApplySpeechRate();
            UpdateSpeedLabel();
        }

        private void ApplySpeechRate()
        {
            _synthesizer.Rate = (int)SpeedSlider.Value;
        }

        private void UpdateSpeedLabel()
        {
            var rate = (int)SpeedSlider.Value;
            string label;
            if (rate <= -5)
                label = "很慢";
            else if (rate <= -2)
                label = "較慢";
            else if (rate >= 5)
                label = "很快";
            else if (rate >= 2)
                label = "較快";
            else
                label = "正常";

            SpeedLabel.Text = label;
        }

        private void UpdateProgressText()
        {
            var total = _content.Segments.Count;
            if (total == 0)
            {
                ProgressText.Text = "";
                return;
            }

            var current = _isPlaying || _currentIndex > 0
                ? Math.Min(_currentIndex + 1, total)
                : 0;

            ProgressText.Text = current > 0
                ? $"進度：第 {current} / {total} 句"
                : $"共 {total} 句，按「開始朗讀」播放";
        }

        private void PlayButton_Click(object sender, RoutedEventArgs e)
        {
            if (_isPaused)
            {
                ResumeReading();
                return;
            }

            if (_isPlaying)
                return;

            if (_currentIndex >= _content.Segments.Count)
                _currentIndex = 0;

            StartReading();
        }

        private void PauseButton_Click(object sender, RoutedEventArgs e)
        {
            if (!_isPlaying || _isPaused)
                return;

            _synthesizer.SpeakAsyncCancelAll();
            _isPaused = true;
            _isPlaying = false;
            UpdateControls();
        }

        private void StopButton_Click(object sender, RoutedEventArgs e)
        {
            StopReading(resetIndex: true);
        }

        private void SegmentList_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (_isPlaying)
                return;

            if (SegmentList.SelectedIndex >= 0)
                _currentIndex = SegmentList.SelectedIndex;
        }

        private void StartReading()
        {
            _isPlaying = true;
            _isPaused = false;
            ApplySpeechRate();
            UpdateControls();
            SpeakCurrentSegment();
        }

        private void ResumeReading()
        {
            _isPaused = false;
            _isPlaying = true;
            ApplySpeechRate();
            UpdateControls();
            SpeakCurrentSegment();
        }

        private void SpeakCurrentSegment()
        {
            if (_currentIndex < 0 || _currentIndex >= _content.Segments.Count)
            {
                FinishReading();
                return;
            }

            SegmentList.SelectedIndex = _currentIndex;
            SegmentList.ScrollIntoView(SegmentList.SelectedItem);
            UpdateProgressText();

            var text = _content.Segments[_currentIndex];
            _synthesizer.SpeakAsync(text);
        }

        private void Synthesizer_SpeakCompleted(object sender, SpeakCompletedEventArgs e)
        {
            if (!_isPlaying)
                return;

            Dispatcher.Invoke(() =>
            {
                if (!_isPlaying)
                    return;

                _currentIndex++;
                if (_currentIndex >= _content.Segments.Count)
                {
                    FinishReading();
                    return;
                }

                SpeakCurrentSegment();
            });
        }

        private void FinishReading()
        {
            _isPlaying = false;
            _isPaused = false;
            UpdateProgressText();
            UpdateControls();
            MessageBox.Show(this, "導讀已完成。", "導讀", MessageBoxButton.OK, MessageBoxImage.Information);
        }

        private void StopReading(bool resetIndex)
        {
            _synthesizer.SpeakAsyncCancelAll();
            _isPlaying = false;
            _isPaused = false;

            if (resetIndex)
            {
                _currentIndex = 0;
                SegmentList.SelectedIndex = -1;
            }

            UpdateProgressText();
            UpdateControls();
        }

        private void UpdateControls()
        {
            if (_isPlaying)
            {
                PlayButton.Content = "朗讀中…";
                PlayButton.IsEnabled = false;
                PauseButton.IsEnabled = true;
                StopButton.IsEnabled = true;
                SpeedSlider.IsEnabled = true;
                SegmentList.IsEnabled = false;
            }
            else if (_isPaused)
            {
                PlayButton.Content = "繼續朗讀";
                PlayButton.IsEnabled = true;
                PauseButton.IsEnabled = false;
                StopButton.IsEnabled = true;
                SpeedSlider.IsEnabled = true;
                SegmentList.IsEnabled = false;
            }
            else
            {
                PlayButton.Content = "開始朗讀";
                PlayButton.IsEnabled = true;
                PauseButton.IsEnabled = false;
                StopButton.IsEnabled = _currentIndex > 0;
                SpeedSlider.IsEnabled = true;
                SegmentList.IsEnabled = true;
            }
        }

        private void LoadDefaultButton_Click(object sender, RoutedEventArgs e)
        {
            StopReading(resetIndex: true);
            if (_content.LoadFromDefaultPath())
            {
                _showChinese = false;
                RefreshSegmentDisplay();
                SubtitleText.Text = "內容來自 read.txt，可調整朗讀速度與跟讀";
                UpdateChineseToggle();
                UpdateProgressText();
            }
            else
            {
                MessageBox.Show(this, "找不到預設文章（read.txt）。", "錯誤", MessageBoxButton.OK, MessageBoxImage.Warning);
            }
        }

        private void LoadFriendsButton_Click(object sender, RoutedEventArgs e)
        {
            StopReading(resetIndex: true);
            string sceneName;
            if (_content.LoadFriendsDialogue(out sceneName))
            {
                _showChinese = true;
                RefreshSegmentDisplay();
                SubtitleText.Text = $"內容來自：{sceneName}，可切換中英對照；朗讀仍只播放英文";
                UpdateChineseToggle();
                UpdateProgressText();
            }
            else
            {
                MessageBox.Show(this, "找不到六人行對話檔（friends.txt）或檔案為空。", "錯誤", MessageBoxButton.OK, MessageBoxImage.Warning);
            }
        }

        private void Window_Closed(object sender, EventArgs e)
        {
            _synthesizer.SpeakAsyncCancelAll();
            _synthesizer.SpeakCompleted -= Synthesizer_SpeakCompleted;
            _synthesizer.Dispose();
        }
    }
}
