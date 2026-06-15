import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CuisineSelectionScreen,
  LoadingScreen,
  QuestionCardScreen,
  ResultsListScreen,
  SingleResultScreen,
  StartScreen,
} from './components/OmNomComponents';
import { mockResults, questions } from './components/omnomData';

type Screen = 'start' | 'cuisine' | 'question' | 'loading' | 'single-result' | 'results';
type Answer = 'yes' | 'no' | 'any';

export default function App() {
  const [screen, setScreen] = useState<Screen>('start');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [resultDishIndex, setResultDishIndex] = useState(0);

  const loadingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (loadingTimer.current) clearTimeout(loadingTimer.current);
  };

  useEffect(() => () => clearTimer(), []);

  const resetState = () => {
    setAnswers([]);
    setQuestionIndex(0);
    setSelectedCuisine(null);
    setResultDishIndex(0);
  };

  const runLoading = useCallback(() => {
    setLoadingProgress(0);
    setScreen('loading');

    const steps = [12, 30, 48, 65, 80, 93, 100];
    let i = 0;

    const tick = () => {
      if (i < steps.length) {
        setLoadingProgress(steps[i]);
        i++;
        const delay = i === steps.length ? 900 : 280 + Math.random() * 380;
        loadingTimer.current = setTimeout(tick, delay);
      } else {
        loadingTimer.current = setTimeout(() => {
          setResultDishIndex(0);
          setScreen('single-result');
        }, 500);
      }
    };

    loadingTimer.current = setTimeout(tick, 200);
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleStart = () => {
    resetState();
    setScreen('cuisine');
  };

  const handleRandomizer = () => {
    resetState();
    const idx = Math.floor(Math.random() * mockResults.length);
    setResultDishIndex(idx);
    setScreen('single-result');
  };

  const handleGoHome = () => {
    clearTimer();
    resetState();
    setScreen('start');
  };

  const handleSelectCuisine = (id: string) => {
    setSelectedCuisine(id);
    setQuestionIndex(0);
    setAnswers([]);
    setTimeout(() => setScreen('question'), 200);
  };

  const handleRandomCuisine = () => {
    const ids = ['asian', 'european', 'central-asia', 'middle-east', 'slavic', 'fast-food'];
    setSelectedCuisine(ids[Math.floor(Math.random() * ids.length)]);
    setQuestionIndex(0);
    setAnswers([]);
    setScreen('question');
  };

  const handleAnswer = (value: Answer) => {
    const next = [...answers, value];
    setAnswers(next);

    if (questionIndex + 1 < questions.length) {
      setQuestionIndex((i) => i + 1);
    } else {
      runLoading();
    }
  };

  const handleRetry = () => {
    resetState();
    setScreen('cuisine');
  };

  const handleNearby = () => {
    // Extend with Telegram map deep-link when available
    // window.Telegram?.WebApp.openLink('...');
  };

  const handleAllResults = () => setScreen('results');

  // ── Derived ───────────────────────────────────────────────────────────────

  const currentQuestion = questions[questionIndex];
  // cuisine = step 1, questions start at step 2
  const progressStep = screen === 'cuisine' ? 1 : questionIndex + 2;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {screen === 'start' && (
        <StartScreen onStart={handleStart} onRandomizer={handleRandomizer} />
      )}

      {screen === 'cuisine' && (
        <CuisineSelectionScreen
          selectedId={selectedCuisine}
          onSelect={handleSelectCuisine}
          onRandom={handleRandomCuisine}
        />
      )}

      {screen === 'question' && currentQuestion && (
        <QuestionCardScreen
          question={currentQuestion}
          step={progressStep}
          onAnswer={handleAnswer}
        />
      )}

      {screen === 'loading' && <LoadingScreen progress={loadingProgress} />}

      {screen === 'single-result' && (
        <SingleResultScreen
          dish={mockResults[resultDishIndex]}
          onNearby={handleNearby}
          onRetry={handleRetry}
          onAllResults={handleAllResults}
          onGoHome={handleGoHome}
        />
      )}

      {screen === 'results' && (
        <ResultsListScreen
          results={mockResults}
          onNearby={handleNearby}
          onRetry={handleRetry}
          onGoHome={handleGoHome}
        />
      )}
    </>
  );
}
