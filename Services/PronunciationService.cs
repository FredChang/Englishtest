using System;
using System.Diagnostics;
using System.Speech.Synthesis;
using System.Threading.Tasks;
using System.Windows.Media;
using System.Windows.Threading;

namespace Englishtest.Services
{
    public class PronunciationService : IDisposable
    {
        private readonly SpeechSynthesizer _synthesizer = new SpeechSynthesizer();
        private readonly Dispatcher _dispatcher;
        private MediaPlayer _player;

        public PronunciationService()
        {
            _dispatcher = Dispatcher.CurrentDispatcher;
            catch
            {
                // 使用系統預設英文語音
            }
        }

        public void SetVoice(string voiceName)
        {
            if (string.IsNullOrWhiteSpace(voiceName))
                return;

            try
            {
                _synthesizer.SelectVoice(voiceName);
            }
            catch { }
        }

        public static bool TryCreateAudioUri(string audioUrl, out Uri uri)
        {
            uri = null;
            if (string.IsNullOrWhiteSpace(audioUrl))
                return false;

            var trimmed = audioUrl.Trim();
            if (trimmed.StartsWith("//", StringComparison.Ordinal))
                trimmed = "https:" + trimmed;

            if (!Uri.TryCreate(trimmed, UriKind.Absolute, out uri))
                return false;

            return uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps;
        }

        public async Task PlayAsync(string word, string audioUrl)
        {
            if (!TryCreateAudioUri(audioUrl, out var uri))
            {
                Speak(word);
                return;
            }

            try
            {
                await PlayAudioUrlAsync(uri).ConfigureAwait(true);
            }
            catch
            {
                Speak(word);
            }
        }

        public void Speak(string word)
        {
            if (string.IsNullOrWhiteSpace(word))
                return;

            RunOnUi(() =>
            {
                _synthesizer.SpeakAsyncCancelAll();
                _synthesizer.SpeakAsync(word.Trim());
            });
        }

        public void OpenDictionary(string url)
        {
            if (string.IsNullOrWhiteSpace(url))
                return;

            Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
        }

        private Task PlayAudioUrlAsync(Uri uri)
        {
            var tcs = new TaskCompletionSource<bool>();

            RunOnUi(() =>
            {
                try
                {
                    StopPlayer();
                    var player = new MediaPlayer();
                    _player = player;

                    void OnEnded(object s, EventArgs e) => Complete(true, null);
                    void OnFailed(object s, ExceptionEventArgs e) =>
                        Complete(false, e.ErrorException ?? new InvalidOperationException("無法播放音訊"));

                    void Complete(bool success, Exception error)
                    {
                        player.MediaEnded -= OnEnded;
                        player.MediaFailed -= OnFailed;
                        if (success)
                            tcs.TrySetResult(true);
                        else
                            tcs.TrySetException(error);
                    }

                    player.MediaEnded += OnEnded;
                    player.MediaFailed += OnFailed;
                    player.Open(uri);
                    player.Play();
                }
                catch (Exception ex)
                {
                    tcs.TrySetException(ex);
                }
            });

            return tcs.Task;
        }

        private void StopPlayer()
        {
            if (_player == null)
                return;

            try
            {
                _player.Close();
            }
            catch
            {
                // 忽略關閉時錯誤
            }

            _player = null;
        }

        private void RunOnUi(Action action)
        {
            if (_dispatcher.CheckAccess())
                action();
            else
                _dispatcher.Invoke(action);
        }

        public void Dispose()
        {
            RunOnUi(() =>
            {
                StopPlayer();
                _synthesizer.Dispose();
            });
        }
    }
}
