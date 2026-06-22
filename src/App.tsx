import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BottomNav,
  CuisineSelectionScreen,
  HistoryScreen,
  LoadingScreen,
  MapScreen,
  NoResultsScreen,
  ProfileScreen,
  QuestionCardScreen,
  ResultsListScreen,
  SingleResultScreen,
  StartScreen,
} from './components/OmNomComponents';
import { questions } from './components/omnomData';
import { getRandomDish, matchDishes, MatchedDish } from './logic/matchDishes';
import { HistoryItem, loadHistory, saveHistory } from './logic/historyStorage';
import { loadDiet } from './logic/settingsStorage';
import { LangProvider } from './locales/LangContext';

export type FlowScreen = 'start' | 'cuisine' | 'question' | 'loading' | 'single-result' | 'results' | 'no-results';
export type TabScreen = 'home' | 'history' | 'map' | 'profile';
type Answer = 'yes' | 'no' | 'any';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabScreen>('home');
  const [flowScreen, setFlowScreen] = useState<FlowScreen>('start');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [results, setResults] = useState<MatchedDish[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [, setDiet] = useState<string[]>([]);
  const [profileInSubPage, setProfileInSubPage] = useState(false);

  const loadingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recentIdsRef = useRef<string[]>([]);

  const clearTimer = () => {
    if (loadingTimer.current) clearTimeout(loadingTimer.current);
  };

  useEffect(() => () => clearTimer(), []);

  useEffect(() => { loadHistory((items) => setHistory(items)); }, []);
  useEffect(() => { loadDiet((items) => setDiet(items)); }, []);

  const addToHistory = (dish: MatchedDish) => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const date = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${String(now.getFullYear()).slice(2)}`;
    const item: HistoryItem = {
      id: `${dish.id}_${Date.now()}`,
      name: dish.name,
      name_uz: dish.name_uz,
      image: dish.image,
      emoji: dish.emoji,
      matchPercent: dish.matchPercent,
      date,
    };
    setHistory((prev) => {
      const next = [item, ...prev].slice(0, 50);
      saveHistory(next);
      return next;
    });
  };

  const resetState = () => {
    setAnswers([]);
    setQuestionIndex(0);
    setSelectedCuisine(null);
    setResults([]);
  };

  const runLoading = useCallback(() => {
    setLoadingProgress(0);
    setFlowScreen('loading');

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
          setFlowScreen('single-result');
        }, 500);
      }
    };

    loadingTimer.current = setTimeout(tick, 200);
  }, []);

  const handleTabChange = (tab: TabScreen) => {
    if (tab !== 'profile') setProfileInSubPage(false);
    if (tab === 'home') {
      clearTimer();
      resetState();
      setFlowScreen('start');
    }
    setActiveTab(tab);
  };

  const handleStart = () => { resetState(); setFlowScreen('cuisine'); };
  const handleRandomizer = () => {
    resetState();
    const randomDish = getRandomDish(recentIdsRef.current);
    recentIdsRef.current = [randomDish.id, ...recentIdsRef.current].slice(0, 6);
    setResults([randomDish]);
    addToHistory(randomDish);
    setFlowScreen('single-result');
  };
  const handleGoHome = () => { clearTimer(); resetState(); setFlowScreen('start'); setActiveTab('home'); };

  const handleSelectCuisine = (id: string) => {
    setSelectedCuisine(id);
    setQuestionIndex(0);
    setAnswers([]);
    setTimeout(() => setFlowScreen('question'), 200);
  };

  const handleRandomCuisine = () => {
    const ids = ['asian', 'european', 'central-asia', 'middle-east', 'slavic', 'fast-food'];
    setSelectedCuisine(ids[Math.floor(Math.random() * ids.length)]);
    setQuestionIndex(0);
    setAnswers([]);
    setFlowScreen('question');
  };

  const handleAnswer = (value: Answer) => {
    const next = [...answers, value];
    setAnswers(next);
    if (questionIndex + 1 < questions.length) {
      setQuestionIndex((i) => i + 1);
    } else {
      // Re-read diet from storage at match time so profile changes mid-session are reflected
      loadDiet((currentDiet) => {
        setDiet(currentDiet);
        const matched = matchDishes(selectedCuisine!, next, currentDiet, recentIdsRef.current);
        if (matched.length === 0) {
          setResults([]);
          setFlowScreen('no-results');
        } else {
          recentIdsRef.current = [...matched.map((d) => d.id), ...recentIdsRef.current].slice(0, 6);
          setResults(matched);
          addToHistory(matched[0]);
          runLoading();
        }
      });
    }
  };

  const handleRetry = () => { resetState(); setFlowScreen('cuisine'); };
  const handleNearby = () => { setActiveTab('map'); };
  const handleAllResults = () => setFlowScreen('results');

  const currentQuestion = questions[questionIndex];
  const nextQuestion = questions[questionIndex + 1] ?? null;
  const progressStep = flowScreen === 'cuisine' ? 1 : questionIndex + 2;

  // Key drives fade-in animation on screen change — deliberately excludes questionIndex
  // so the quiz shell (logo + progress + buttons) stays mounted between questions.
  const screenKey = activeTab !== 'home' ? activeTab : flowScreen;

  // Nav is hidden during the quiz flow; fades back in on result/tabs
  const showNav =
    (activeTab !== 'home' && !(activeTab === 'profile' && profileInSubPage)) ||
    flowScreen === 'start' ||
    flowScreen === 'single-result' ||
    flowScreen === 'results' ||
    flowScreen === 'no-results';

  let content: React.ReactNode;

  if (activeTab === 'history') {
    content = <HistoryScreen history={history} />;
  } else if (activeTab === 'map') {
    content = <MapScreen />;
  } else if (activeTab === 'profile') {
    content = <ProfileScreen onSubPageChange={setProfileInSubPage} />;
  } else if (flowScreen === 'start') {
    content = <StartScreen onStart={handleStart} onRandomizer={handleRandomizer} />;
  } else if (flowScreen === 'cuisine') {
    content = (
      <CuisineSelectionScreen
        selectedId={selectedCuisine}
        onSelect={handleSelectCuisine}
        onRandom={handleRandomCuisine}
      />
    );
  } else if (flowScreen === 'question' && currentQuestion) {
    content = (
      <QuestionCardScreen
        question={currentQuestion}
        nextQuestion={nextQuestion}
        step={progressStep}
        onAnswer={handleAnswer}
      />
    );
  } else if (flowScreen === 'loading') {
    content = <LoadingScreen progress={loadingProgress} />;
  } else if (flowScreen === 'single-result' && results[0]) {
    content = (
      <SingleResultScreen
        dish={results[0]}
        onNearby={handleNearby}
        onRetry={handleRetry}
        onAllResults={handleAllResults}
        onGoHome={handleGoHome}
      />
    );
  } else if (flowScreen === 'results') {
    content = (
      <ResultsListScreen
        results={results}
        onNearby={handleNearby}
        onRetry={handleRetry}
        onGoHome={handleGoHome}
      />
    );
  } else if (flowScreen === 'no-results') {
    content = <NoResultsScreen onRetry={handleRetry} onGoHome={handleGoHome} />;
  }

  return (
    <LangProvider>
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', height: '100dvh' }}>
        {/* Content area — key forces re-mount → triggers screenFadeIn on every screen change */}
        <div
          key={screenKey}
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            backgroundColor: '#FFF1DC',
            animation: 'screenFadeIn 0.28s cubic-bezier(0.22, 1, 0.36, 1) both',
          }}
        >
          {content}
        </div>

        {/* Bottom nav — slides in/out with opacity+height; never re-mounts */}
        <div
          style={{
            flexShrink: 0,
            overflow: 'hidden',
            maxHeight: showNav ? '120px' : '0px',
            opacity: showNav ? 1 : 0,
            transition: 'max-height 0.35s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
            pointerEvents: showNav ? 'auto' : 'none',
          }}
        >
          <BottomNav active={activeTab} onTabChange={handleTabChange} />
        </div>
      </div>
    </LangProvider>
  );
}
