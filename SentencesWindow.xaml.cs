using System;
using System.Collections.Generic;
using System.Linq;
using System.Speech.Synthesis;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using Englishtest.Models;
using Englishtest.Services;

namespace Englishtest
{
    public partial class SentencesWindow : Window
    {
        private readonly SentencesService _service;
        private SpeechSynthesizer _synth;
        private SentenceItem _currentSentence;
        private readonly List<SentenceItem> _history = new List<SentenceItem>();
        private int _historyIndex = -1;
        private int _seqIndex = 0;
        private bool _isRevealed = false;

        public SentencesWindow()
        {
            InitializeComponent();
            _service = new SentencesService();
            InitSpeech();
            LoadData();
        }

        private void InitSpeech()
        {
            try
            {
                _synth = new SpeechSynthesizer();
                var voices = _synth.GetInstalledVoices()
                    .Where(v => v.Enabled && v.VoiceInfo.Culture.Name.StartsWith("en"))
                    .ToList();
                if (voices.Any())
                {
                    var chosen = voices.FirstOrDefault(v => v.VoiceInfo.Name.Contains("Zira")) ?? voices.First();
                    _synth.SelectVoice(chosen.VoiceInfo.Name);
                }
            }
            catch { }
        }

        private void LoadData()
        {
            if (_service.Load())
            {
                var cats = new List<string> { "全部類別" };
                cats.AddRange(_service.Categories);
                CategoryComboBox.ItemsSource = cats;
                CategoryComboBox.SelectedIndex = 0;

                UpdateStats();
                NextSentence();
            }
            else
            {
                MessageBox.Show("找不到 1000 句題庫檔案 (sentences_1000.json)。", "載入失敗", MessageBoxButton.OK, MessageBoxImage.Warning);
            }
        }

        private void UpdateStats()
        {
            StatUnmaskedText.Text = $"循環中: {_service.UnmaskedCount} 句";
            StatMaskedText.Text = $"已學會遮罩: {_service.MaskedCount} 句";
        }

        private string GetSelectedCategory()
        {
            return CategoryComboBox.SelectedItem?.ToString() ?? "全部類別";
        }

        private void NextSentence()
        {
            var cat = GetSelectedCategory();
            var available = _service.GetFiltered(cat, includeMasked: false);

            if (available.Count == 0)
            {
                ZhText.Text = "🎉 太棒了！您已經學會此類別下的所有句子！";
                EnText.Text = "All sentences in this category are marked as learned (masked).";
                EnMaskOverlay.Visibility = Visibility.Collapsed;
                MaskSentenceButton.IsEnabled = false;
                return;
            }

            MaskSentenceButton.IsEnabled = true;
            SentenceItem nextItem = null;
            if (ModeRandomRadio.IsChecked == true)
            {
                nextItem = _service.GetRandomNext(cat, _currentSentence?.id ?? -1);
            }
            else
            {
                var allInCat = _service.GetFiltered(cat, includeMasked: true);
                if (_seqIndex >= allInCat.Count) _seqIndex = 0;
                nextItem = allInCat[_seqIndex];
                _seqIndex = (_seqIndex + 1) % allInCat.Count;
            }

            if (nextItem != null)
            {
                _history.Add(nextItem);
                _historyIndex = _history.Count - 1;
                SetCurrentSentence(nextItem);
            }
        }

        private void SetCurrentSentence(SentenceItem item)
        {
            _currentSentence = item;
            _isRevealed = MaskEnCheckBox.IsChecked != true;

            BadgeIdText.Text = $"#{item.id} / 1000";
            BadgeCatText.Text = item.category ?? "常用句子";
            ZhText.Text = item.zh;
            EnText.Text = item.en;

            UpdateCardMaskState();
            UpdateMaskSentenceButton();
            UpdateStats();
            PrevButton.IsEnabled = _historyIndex > 0;
        }

        private void UpdateCardMaskState()
        {
            if (_isRevealed || MaskEnCheckBox.IsChecked != true)
            {
                EnMaskOverlay.Visibility = Visibility.Collapsed;
                RevealButton.Content = "🙈 遮罩英文";
            }
            else
            {
                EnMaskOverlay.Visibility = Visibility.Visible;
                RevealButton.Content = "👁️ 點擊揭曉英文";
            }
        }

        private void UpdateMaskSentenceButton()
        {
            if (_currentSentence == null) return;
            bool isMasked = _service.IsMasked(_currentSentence.id);

            if (isMasked)
            {
                MaskSentenceButton.Content = "✅ 已學會 (已遮罩，不入隨機名單)";
                MaskSentenceButton.Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#DCFCE7"));
                MaskSentenceButton.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#15803D"));
                MaskSentenceButton.BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#86EFAC"));
            }
            else
            {
                MaskSentenceButton.Content = "⚪ 標記已學會 (遮罩此句排除)";
                MaskSentenceButton.Background = Brushes.White;
                MaskSentenceButton.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#475569"));
                MaskSentenceButton.BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#CBD5E1"));
            }
        }

        private void PlayAudio()
        {
            if (_currentSentence == null || _synth == null) return;
            try
            {
                _synth.SpeakAsyncCancelAll();
                _synth.SpeakAsync(_currentSentence.en);
            }
            catch { }
        }

        private void PlayButton_Click(object sender, RoutedEventArgs e)
        {
            PlayAudio();
        }

        private void RevealButton_Click(object sender, RoutedEventArgs e)
        {
            _isRevealed = !_isRevealed;
            UpdateCardMaskState();
        }

        private void EnBox_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            _isRevealed = !_isRevealed;
            UpdateCardMaskState();
        }

        private void MaskSentenceButton_Click(object sender, RoutedEventArgs e)
        {
            if (_currentSentence == null) return;
            _service.ToggleMask(_currentSentence.id);
            UpdateMaskSentenceButton();
            UpdateStats();
        }

        private void PrevButton_Click(object sender, RoutedEventArgs e)
        {
            if (_historyIndex > 0)
            {
                _historyIndex--;
                SetCurrentSentence(_history[_historyIndex]);
            }
        }

        private void NextButton_Click(object sender, RoutedEventArgs e)
        {
            NextSentence();
        }

        private void CategoryComboBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (!IsLoaded) return;
            _seqIndex = 0;
            NextSentence();
        }

        private void ModeRadio_Checked(object sender, RoutedEventArgs e)
        {
            if (!IsLoaded) return;
            NextButton.Content = ModeRandomRadio.IsChecked == true ? "🎲 隨機下一句" : "➡️ 依序下一句";
        }

        private void MaskEnCheckBox_Changed(object sender, RoutedEventArgs e)
        {
            if (!IsLoaded) return;
            _isRevealed = MaskEnCheckBox.IsChecked != true;
            UpdateCardMaskState();
        }

        private void ManageListButton_Click(object sender, RoutedEventArgs e)
        {
            var win = new Window
            {
                Title = "常用 1000 句清單與遮罩管理",
                Width = 650,
                Height = 600,
                WindowStartupLocation = WindowStartupLocation.CenterOwner,
                Owner = this,
                Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#F4F6F8"))
            };

            var grid = new Grid { Margin = new Thickness(16) };
            grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            grid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
            grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });

            var topPanel = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 0, 0, 10) };
            var searchBox = new TextBox { Width = 260, Height = 30, VerticalContentAlignment = VerticalAlignment.Center };
            var filterCombo = new ComboBox { Width = 140, Height = 30, Margin = new Thickness(8, 0, 0, 0) };
            filterCombo.ItemsSource = new[] { "全部", "僅顯示待學習", "僅顯示已學會遮罩" };
            filterCombo.SelectedIndex = 0;

            topPanel.Children.Add(new TextBlock { Text = "🔍 搜尋: ", VerticalAlignment = VerticalAlignment.Center });
            topPanel.Children.Add(searchBox);
            topPanel.Children.Add(filterCombo);
            Grid.SetRow(topPanel, 0);
            grid.Children.Add(topPanel);

            var listView = new ListBox
            {
                BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#CBD5E1")),
                Background = Brushes.White
            };

            Action refreshList = () =>
            {
                var q = searchBox.Text.Trim().ToLower();
                var fIdx = filterCombo.SelectedIndex;

                var list = _service.AllSentences.Where(s =>
                {
                    if (fIdx == 1 && s.IsMasked) return false;
                    if (fIdx == 2 && !s.IsMasked) return false;
                    if (!string.IsNullOrEmpty(q))
                    {
                        bool match = s.en.ToLower().Contains(q) || s.zh.Contains(q) || s.id.ToString() == q;
                        if (!match) return false;
                    }
                    return true;
                }).ToList();

                listView.ItemsSource = list;
            };

            searchBox.TextChanged += (s, ev) => refreshList();
            filterCombo.SelectionChanged += (s, ev) => refreshList();

            var template = new DataTemplate(typeof(SentenceItem));
            var factory = new FrameworkElementFactory(typeof(Border));
            factory.SetValue(Border.PaddingProperty, new Thickness(8));
            factory.SetValue(Border.MarginProperty, new Thickness(0, 2, 0, 2));
            factory.SetValue(Border.CornerRadiusProperty, new CornerRadius(6));

            var stack = new FrameworkElementFactory(typeof(StackPanel));

            var metaStack = new FrameworkElementFactory(typeof(StackPanel));
            metaStack.SetValue(StackPanel.OrientationProperty, Orientation.Horizontal);

            var idBlock = new FrameworkElementFactory(typeof(TextBlock));
            idBlock.SetBinding(TextBlock.TextProperty, new System.Windows.Data.Binding("id") { StringFormat = "#{0} " });
            idBlock.SetValue(TextBlock.FontWeightProperty, FontWeights.Bold);
            idBlock.SetValue(TextBlock.ForegroundProperty, new SolidColorBrush((Color)ColorConverter.ConvertFromString("#6366F1")));
            metaStack.AppendChild(idBlock);

            var catBlock = new FrameworkElementFactory(typeof(TextBlock));
            catBlock.SetBinding(TextBlock.TextProperty, new System.Windows.Data.Binding("category"));
            catBlock.SetValue(TextBlock.ForegroundProperty, Brushes.Gray);
            metaStack.AppendChild(catBlock);

            stack.AppendChild(metaStack);

            var zhBlock = new FrameworkElementFactory(typeof(TextBlock));
            zhBlock.SetBinding(TextBlock.TextProperty, new System.Windows.Data.Binding("zh"));
            zhBlock.SetValue(TextBlock.FontWeightProperty, FontWeights.SemiBold);
            zhBlock.SetValue(TextBlock.FontSizeProperty, 14.0);
            zhBlock.SetValue(TextBlock.TextWrappingProperty, TextWrapping.Wrap);
            stack.AppendChild(zhBlock);

            var enBlock = new FrameworkElementFactory(typeof(TextBlock));
            enBlock.SetBinding(TextBlock.TextProperty, new System.Windows.Data.Binding("en"));
            enBlock.SetValue(TextBlock.ForegroundProperty, new SolidColorBrush((Color)ColorConverter.ConvertFromString("#2563EB")));
            enBlock.SetValue(TextBlock.TextWrappingProperty, TextWrapping.Wrap);
            stack.AppendChild(enBlock);

            factory.AppendChild(stack);
            template.VisualTree = factory;
            listView.ItemTemplate = template;

            listView.MouseDoubleClick += (s, ev) =>
            {
                if (listView.SelectedItem is SentenceItem selected)
                {
                    SetCurrentSentence(selected);
                    win.Close();
                }
            };

            Grid.SetRow(listView, 1);
            grid.Children.Add(listView);

            var botPanel = new Grid { Margin = new Thickness(0, 10, 0, 0) };
            botPanel.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            botPanel.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

            var resetBtn = new Button
            {
                Content = "🔄 重設全部遮罩",
                Height = 32,
                Padding = new Thickness(10, 0, 10, 0),
                Foreground = Brushes.DarkRed,
                Background = Brushes.White,
                BorderBrush = Brushes.LightGray
            };
            resetBtn.Click += (s, ev) =>
            {
                if (MessageBox.Show("確定要重設所有已遮罩句子嗎？\n這將把全部已學會的句子重新放回隨機循環名單。", "重設確認", MessageBoxButton.YesNo, MessageBoxImage.Question) == MessageBoxResult.Yes)
                {
                    _service.ResetAllMasked();
                    refreshList();
                    UpdateMaskSentenceButton();
                    UpdateStats();
                }
            };

            var closeBtn = new Button { Content = "關閉", Width = 80, Height = 32, Margin = new Thickness(8, 0, 0, 0) };
            closeBtn.Click += (s, ev) => win.Close();

            Grid.SetColumn(resetBtn, 0);
            resetBtn.HorizontalAlignment = HorizontalAlignment.Left;
            botPanel.Children.Add(resetBtn);

            Grid.SetColumn(closeBtn, 1);
            botPanel.Children.Add(closeBtn);

            Grid.SetRow(botPanel, 2);
            grid.Children.Add(botPanel);

            win.Content = grid;
            refreshList();
            win.ShowDialog();

            UpdateMaskSentenceButton();
            UpdateStats();
        }

        private void CloseButton_Click(object sender, RoutedEventArgs e)
        {
            Close();
        }

        private void Window_Closed(object sender, EventArgs e)
        {
            _synth?.Dispose();
            _synth = null;
        }
    }
}
