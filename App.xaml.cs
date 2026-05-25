using System.Linq;
using System.Windows;
using Englishtest.Models;
using Englishtest.Services;

namespace Englishtest
{
    public partial class App : Application
    {
        private void App_OnStartup(object sender, StartupEventArgs e)
        {
            // Prevent WPF from shutting down when SetupWindow (the first window) closes.
            ShutdownMode = ShutdownMode.OnExplicitShutdown;

            var vocabulary = new VocabularyService();
            vocabulary.Load();

            if (vocabulary.CountByLevel.Values.Sum() == 0)
            {
                MessageBox.Show(
                    "找不到題庫（words.json）。請確認檔案存在於程式目錄後重新建置。",
                    "無法啟動",
                    MessageBoxButton.OK,
                    MessageBoxImage.Error);
                Shutdown();
                return;
            }

            while (true)
            {
                var setup = new SetupWindow(vocabulary);
                if (setup.ShowDialog() != true || setup.Settings == null)
                {
                    Shutdown();
                    return;
                }

                Window target;

                if (setup.Settings.Mode == QuizMode.MultipleChoice)
                {
                    var mc = new MultipleChoiceWindow(setup.Settings, vocabulary);
                    if (!mc.IsReady)
                        continue;
                    target = mc;
                }
                else
                {
                    var main = new MainWindow(setup.Settings, vocabulary);
                    if (!main.IsReady)
                        continue;
                    target = main;
                }

                MainWindow = target;
                // Restore normal shutdown mode now that the real MainWindow is set.
                ShutdownMode = ShutdownMode.OnMainWindowClose;
                target.Show();
                return;
            }
        }
    }
}
