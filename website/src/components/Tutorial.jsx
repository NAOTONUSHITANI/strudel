import { useState, useEffect } from 'react';

const tutorialSteps = [
  {
    title: 'Strudel AIアシスタントへようこそ！',
    content: 'AIとの対話を通じて、Strudelでの音楽制作をサポートします。',
  },
  {
    title: 'コードを生成する',
    content: '例えば「4つ打ちのキックを作って」のように、作りたい音楽のイメージを伝えてみましょう。',
  },
  {
    title: 'コードをエディタに挿入する',
    content: 'AIが生成したコードは、ボタン一つでエディタのカーソル位置に直接挿入できます。',
  },
  {
    title: '準備完了！',
    content: '早速AIアシスタントと会話を始めて、新しい音楽のアイデアを探求しましょう！',
  },
];

export function Tutorial() {
  const [step, setStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // localStorageをチェックして、チュートリアルを既に見たか確認
    const hasSeenTutorial = localStorage.getItem('hasSeenTutorial');
    if (!hasSeenTutorial) {
      setIsVisible(true);
    }
  }, []);

  const handleNext = () => {
    if (step < tutorialSteps.length - 1) {
      setStep(step + 1);
    } else {
      // 最後のステップで完了
      handleClose();
    }
  };

  const handleClose = () => {
    // localStorageにフラグを保存して、次回から表示しないようにする
    localStorage.setItem('hasSeenTutorial', 'true');
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  const currentStep = tutorialSteps[step];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[200]">
      <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-2xl w-full max-w-md flex flex-col text-white">
        <header className="p-4 border-b border-gray-700">
          <h2 className="font-bold text-lg">{currentStep.title}</h2>
        </header>
        <main className="p-4 flex-1">
          <p>{currentStep.content}</p>
        </main>
        <footer className="p-4 flex justify-between items-center bg-gray-900">
          <div className="flex gap-2">
            {tutorialSteps.map((_, index) => (
              <div
                key={index}
                className={`w-3 h-3 rounded-full ${step === index ? 'bg-blue-500' : 'bg-gray-600'}`}
              />
            ))}
          </div>
          <div className="flex gap-4">
            {step < tutorialSteps.length - 1 && (
              <button onClick={handleClose} className="text-gray-400 hover:text-white">
                Skip
              </button>
            )}
            <button
              onClick={handleNext}
              className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
            >
              {step < tutorialSteps.length - 1 ? 'Next' : 'Done'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
