import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppErrorScreen,
  AppLoadingScreen,
  BottomNav,
  CuisineSelectionScreen,
  HistoryScreen,
  LoadingScreen,
  FoodBattleScreen,
  ModeSelectScreen,
  NoResultsScreen,
  ProfileScreen,
  QuestionCardScreen,
  ResultsListScreen,
  SingleResultScreen,
  StartScreen,
} from './components/OmNomComponents';
import {
  allCuisinesResults,
  Answer,
  ANY_CUISINE,
  applyAnswer,
  Dish,
  getLookahead,
  isFinished,
  MatchedDish,
  Mode,
  nextProgress,
  pickNextQuestion,
  pickRandomDish,
  Question,
  rankResults,
  Session,
  startSession,
} from './logic/engine';
import { flush as flushEvents, track } from './logic/analytics';
import { AppData, loadData } from './logic/dataStore';
import { clearHistory, formatDate, HistoryItem, HistoryMode, loadHistory, saveHistoryItem } from './logic/historyStorage';
import { buildSessionRows, newSessionId, saveSessionAnswers } from './logic/sessionAnswers';
import { loadSettings } from './logic/settingsStorage';
import { LangProvider } from './locales/LangContext';

export type FlowScreen = 'start' | 'mode' | 'cuisine' | 'question' | 'loading' | 'single-result' | 'results' | 'no-results';
export type TabScreen = 'home' | 'history' | 'battle' | 'profile';

type QuizView = { session: Session; question: Question; isLast: boolean; remaining: number; progress: number };

function getAllergens(): Promise<string[]> {
  return loadSettings().then((s) => s.allergens).catch(() => []);
}

export default function App() {
  return (
    <LangProvider>
      <OmNomApp />
    </LangProvider>
  );
}

function OmNomApp() {
  const [activeTab, setActiveTab] = useState<TabScreen>('home');
  const [flowScreen, setFlowScreen] = useState<FlowScreen>('start');
  const [data, setData] = useState<AppData | null>(null);
  const [dataError, setDataError] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<QuizView | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [results, setResults] = useState<MatchedDish[]>([]);
  const [exactMatch, setExactMatch] = useState(true);
  const [allCuisineResults, setAllCuisineResults] = useState<MatchedDish[] | null>(null);
  const [resultVariant, setResultVariant] = useState<'quiz' | 'randomizer'>('quiz');
  const allergensRef = useRef<string[]>([]);
  const randomDishRef = useRef<Dish | null>(null);
  const [profileInSubPage, setProfileInSubPage] = useState(false);
  // Ограничения профиля для «Или / Или»: обновляем при входе на вкладку, чтобы правка
  // аллергенов в профиле применялась к следующей игре.
  const [battleAllergens, setBattleAllergens] = useState<string[]>([]);

  const quizRef = useRef<QuizView | null>(null);
  const finalizedRef = useRef<Session | null>(null);
  // Created when the quiz starts, not when it ends, so abandoned sessions are identifiable too.
  const quizIdRef = useRef<string | null>(null);
  const quizStartedAtRef = useRef(0);
  const pendingAnswersRef = useRef<{ id: string; session: Session; guessedDishId: string } | null>(null);
  const rejectedIdsRef = useRef<string[]>([]);
  const loadingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (loadingTimer.current) clearTimeout(loadingTimer.current);
  };

  useEffect(() => () => clearTimer(), []);

  const initApp = useCallback(async () => {
    setDataError(false);
    setData(null);
    try {
      const [appData, historyItems] = await Promise.all([loadData(), loadHistory()]);
      setHistory(historyItems);
      setData(appData);
    } catch (e) {
      console.error('[OmNom] data load failed:', e);
      setDataError(true);
    }
  }, []);

  useEffect(() => { initApp(); }, [initApp]);

  const addToHistory = (dish: Dish, mode: HistoryMode, matchPercent: number | null) => {
    const item: HistoryItem = {
      id: `${dish.id}_${Date.now()}`,
      dishId: dish.id,
      name: dish.name,
      image: dish.image,
      mode,
      matchPercent,
      date: formatDate(new Date()),
    };
    setHistory((prev) => [item, ...prev].slice(0, 50));
    saveHistoryItem(dish, mode, matchPercent);
  };

  const setQuizView = (view: QuizView | null) => {
    quizRef.current = view;
    setQuiz(view);
  };

  // Answers of a finished session are written once, when leaving the result.
  const flushSessionAnswers = () => {
    const pending = pendingAnswersRef.current;
    if (!pending) return;
    pendingAnswersRef.current = null;
    saveSessionAnswers(buildSessionRows(pending.id, pending.session, pending.guessedDishId, null));
  };

  // A quiz still on screen when state is reset was left unfinished, whatever path got us here.
  const abandonIfRunning = () => {
    const view = quizRef.current;
    if (!view) return;
    track('test_abandoned', {
      session_id: quizIdRef.current,
      mode: view.session.mode,
      cuisine: view.session.cuisine,
      question_id: view.question.id,
      props: { answered: view.session.answered, swipes: view.session.swipes },
    });
    quizIdRef.current = null;
  };

  const resetState = () => {
    abandonIfRunning();
    flushSessionAnswers();
    clearTimer();
    setQuizView(null);
    setSelectedCuisine(null);
    setResults([]);
    setAllCuisineResults(null);
    flushEvents();
  };

  const runLoading = () => {
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
        loadingTimer.current = setTimeout(() => setFlowScreen('single-result'), 500);
      }
    };
    loadingTimer.current = setTimeout(tick, 200);
  };

  const finalizeQuiz = (session: Session) => {
    if (finalizedRef.current === session) return;
    finalizedRef.current = session;
    setQuizView(null);
    const own = rankResults(session);
    const top = own.dishes;
    const sessionId = quizIdRef.current;
    track('test_completed', {
      session_id: sessionId,
      mode: session.mode,
      cuisine: session.cuisine,
      props: {
        answered: session.answered,
        swipes: session.swipes,
        duration_ms: Date.now() - quizStartedAtRef.current,
        exact: own.exact,
        top: top.slice(0, 3).map((d) => ({ id: d.id, pct: d.matchPercent, cuisine: d.cuisine })),
      },
    });
    if (top.length === 0) {
      setResults([]);
      setFlowScreen('no-results');
      return;
    }
    track('results_shown', {
      session_id: sessionId,
      mode: session.mode,
      cuisine: session.cuisine,
      dish_id: top[0].id,
      props: { pct: top[0].matchPercent, count: top.length, exact: own.exact },
    });
    const all = session.mode === 'meal' && session.cuisine !== ANY_CUISINE
      ? allCuisinesResults(data!.dishes, session.log, allergensRef.current).dishes
      : [];
    setResultVariant('quiz');
    setResults(top);
    setExactMatch(own.exact);
    setAllCuisineResults(all.length > 0 ? all : null);
    pendingAnswersRef.current = { id: sessionId ?? newSessionId(), session, guessedDishId: top[0].id };
    addToHistory(top[0], session.mode, top[0].matchPercent);
    runLoading();
  };

  const showQuestion = (session: Session, question: Question, prevProgress: number) => {
    const { isLastQuestion, remainingEstimate } = getLookahead(data!.questions, session, question);
    track('question_shown', {
      session_id: quizIdRef.current,
      mode: session.mode,
      cuisine: session.cuisine,
      question_id: question.id,
      question_index: session.swipes + 1,
      props: { tag: question.tag, candidates: session.candidates.length },
    });
    setQuizView({
      session, question, isLast: isLastQuestion, remaining: remainingEstimate,
      progress: nextProgress(prevProgress, data!.questions, session),
    });
    setFlowScreen('question');
  };

  const beginQuiz = async (mode: Mode, cuisine: string) => {
    if (!data) return;
    allergensRef.current = await getAllergens();
    const session = startSession(data.dishes, mode, cuisine, allergensRef.current);
    quizIdRef.current = newSessionId();
    quizStartedAtRef.current = Date.now();
    track('test_started', {
      session_id: quizIdRef.current,
      mode,
      cuisine,
      props: { candidates: session.candidates.length, allergens: allergensRef.current.length },
    });
    if (session.candidates.length === 0) {
      setResults([]);
      setFlowScreen('no-results');
      return;
    }
    const first = pickNextQuestion(data.questions, session);
    if (!first || isFinished(data.questions, session)) finalizeQuiz(session);
    else showQuestion(session, first, 0);
  };

  const handleAnswer = useCallback((answer: Answer) => {
    const view = quizRef.current;
    if (!view || !data) return;
    const next = applyAnswer(view.session, view.question, answer);
    track('question_answered', {
      session_id: quizIdRef.current,
      mode: next.mode,
      cuisine: next.cuisine,
      question_id: view.question.id,
      answer,
      question_index: view.session.swipes + 1,
      props: { tag: view.question.tag },
    });
    const nq = isFinished(data.questions, next) ? null : pickNextQuestion(data.questions, next);
    if (!nq) finalizeQuiz(next);
    else showQuestion(next, nq, view.progress);
  }, [data]);

  const handleRandomizer = async (rejectCurrent: boolean) => {
    if (!data) return;
    const current = randomDishRef.current;
    if (rejectCurrent && current) {
      rejectedIdsRef.current = [current.id, ...rejectedIdsRef.current].slice(0, 30);
      track('recommendation_rejected', { dish_id: current.id, props: { source: 'random' } });
    }
    resetState();
    const rejected = new Set(rejectedIdsRef.current);
    const historyIds = history.map((h) => h.dishId);
    const dish = pickRandomDish({
      dishes: data.dishes,
      excludeAllergens: await getAllergens(),
      recentIds: historyIds,
      likedIds: historyIds.filter((id) => !rejected.has(id)),
      rejectedIds: rejectedIdsRef.current,
    });
    if (!dish) {
      setFlowScreen('no-results');
      return;
    }
    track('random_selected', { dish_id: dish.id, cuisine: dish.cuisine, props: { rerolled: rejectCurrent } });
    setResultVariant('randomizer');
    randomDishRef.current = dish;
    setResults([{ ...dish, matchPercent: null }]);
    setExactMatch(true);
    addToHistory(dish, 'random', null);
    setFlowScreen('single-result');
  };

  const handleBattleWinner = useCallback((dish: Dish) => {
    track('battle_winner', { dish_id: dish.id, cuisine: dish.cuisine });
    addToHistory(dish, 'battle', null);
    flushEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTabChange = (tab: TabScreen) => {
    if (tab !== 'profile') setProfileInSubPage(false);
    if (tab === 'battle') {
      getAllergens().then(setBattleAllergens).catch(() => setBattleAllergens([]));
      track('battle_opened');
    }
    if (tab === 'home') {
      resetState();
      setFlowScreen('start');
    }
    setActiveTab(tab);
  };

  const handleStart = () => { resetState(); setFlowScreen('mode'); };
  const handleSelectMode = (mode: Mode) => {
    if (mode === 'meal') setFlowScreen('cuisine');
    else beginQuiz(mode, ANY_CUISINE);
  };
  const handleSelectCuisine = (id: string) => { setSelectedCuisine(id); beginQuiz('meal', id); };
  const handleAnyCuisine = () => { setSelectedCuisine(ANY_CUISINE); beginQuiz('meal', ANY_CUISINE); };
  const handleGoHome = () => { resetState(); setFlowScreen('start'); setActiveTab('home'); };
  // «Ещё раз» on a result is the only rejection signal the current screens can give.
  const handleRetry = () => {
    if (resultVariant === 'quiz' && results[0]) {
      track('recommendation_rejected', {
        session_id: pendingAnswersRef.current?.id ?? null,
        dish_id: results[0].id,
        props: { source: 'quiz', pct: results[0].matchPercent },
      });
    }
    resetState();
    setFlowScreen('mode');
  };
  const handleOpenHistory = () => { resetState(); setFlowScreen('start'); setActiveTab('history'); };
  const handleClearHistory = async () => { await clearHistory(); setHistory([]); };

  const screenKey = !data
    ? (dataError ? 'app-error' : 'app-loading')
    : activeTab !== 'home' ? activeTab : flowScreen;

  const showNav = !!data && (
    (activeTab !== 'home' && !(activeTab === 'profile' && profileInSubPage)) ||
    ['start', 'mode', 'single-result', 'results', 'no-results'].includes(flowScreen)
  );

  let content: React.ReactNode = null;
  if (!data) {
    content = dataError ? <AppErrorScreen onRetry={initApp} /> : <AppLoadingScreen />;
  } else if (activeTab === 'history') {
    content = <HistoryScreen history={history} dishById={data.dishById} />;
  } else if (activeTab === 'battle') {
    content = (
      <FoodBattleScreen
        dishes={data.dishes}
        allergens={battleAllergens}
        onWinner={handleBattleWinner}
        onGoHome={handleGoHome}
      />
    );
  } else if (activeTab === 'profile') {
    content = <ProfileScreen onSubPageChange={setProfileInSubPage} onClearHistory={handleClearHistory} />;
  } else if (flowScreen === 'start') {
    content = <StartScreen onStart={handleStart} onRandomizer={() => handleRandomizer(false)} />;
  } else if (flowScreen === 'mode') {
    content = <ModeSelectScreen onSelect={handleSelectMode} />;
  } else if (flowScreen === 'cuisine') {
    content = (
      <CuisineSelectionScreen
        selectedId={selectedCuisine}
        onSelect={handleSelectCuisine}
        onRandom={handleAnyCuisine}
      />
    );
  } else if (flowScreen === 'question' && quiz) {
    content = (
      <QuestionCardScreen
        question={quiz.question}
        isLast={quiz.isLast}
        progress={quiz.progress}
        questionNumber={quiz.session.swipes + 1}
        remaining={quiz.remaining}
        onAnswer={handleAnswer}
      />
    );
  } else if (flowScreen === 'loading') {
    content = <LoadingScreen progress={loadingProgress} />;
  } else if (flowScreen === 'single-result' && results[0]) {
    content = (
      <SingleResultScreen
        dish={results[0]}
        exact={exactMatch}
        variant={resultVariant}
        onRetry={resultVariant === 'randomizer' ? () => handleRandomizer(true) : handleRetry}
        onAllResults={resultVariant === 'quiz' ? () => {
          // Looking past the top dish is the implicit «you didn't guess it» signal.
          track('all_variants_opened', {
            session_id: pendingAnswersRef.current?.id ?? null,
            dish_id: results[0]?.id ?? null,
            props: { pct: results[0]?.matchPercent ?? null },
          });
          setFlowScreen('results');
        } : undefined}
        onGoHome={handleGoHome}
      />
    );
  } else if (flowScreen === 'results') {
    content = (
      <ResultsListScreen
        sameCuisineResults={results}
        allCuisineResults={allCuisineResults}
        onTabChange={(tab) => {
          if (tab !== 'all') return;
          track('other_cuisine_opened', {
            session_id: pendingAnswersRef.current?.id ?? null,
            props: { top: (allCuisineResults ?? []).slice(0, 3).map((d) => ({ id: d.id, pct: d.matchPercent })) },
          });
        }}
        onOpenHistory={handleOpenHistory}
        onRetry={handleRetry}
        onGoHome={handleGoHome}
      />
    );
  } else if (flowScreen === 'no-results') {
    content = <NoResultsScreen onRetry={handleRetry} onGoHome={handleGoHome} />;
  }

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      {/* key re-mounts on screen change → screenFadeIn; the quiz keeps one key between questions */}
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
  );
}
