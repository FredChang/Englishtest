using System;
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

        public bool IsReady { get; private set; }

        public GuideReadingWindow()
        {
            InitializeComponent();
            ConfigureVoice();

            if (!_content.LoadFromDefaultPath())
            {
                MessageBox.Show(
                    "找不到導讀內容（read.txt）。請確認檔案存在於程式目錄。",
                    "無法開啟導讀",
                    MessageBoxButton.OK,
                    MessageBoxImage.Warning);
                IsReady = false;
                return;
            }

            SegmentList.ItemsSource = _content.Segments;
            IsReady = true;
            UpdateSpeedLabel();
            UpdateProgressText();
        }

        private void ConfigureVoice()
        {
            try
            {
                _synthesizer.SelectVoiceByHints(
                    VoiceGender.NotSet,
                    VoiceAge.Adult,
                    0,
                    System.Globalization.CultureInfo.GetCultureInfo("en-US"));
            }
            catch
            {
                // 使用系統預設語音
            }

            _synthesizer.SpeakCompleted += Synthesizer_SpeakCompleted;
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

        private void Window_Closed(object sender, EventArgs e)
        {
            _synthesizer.SpeakAsyncCancelAll();
            _synthesizer.SpeakCompleted -= Synthesizer_SpeakCompleted;
            _synthesizer.Dispose();
        }
    }
}
