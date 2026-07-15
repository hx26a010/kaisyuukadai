import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  RotateCw, 
  HelpCircle, 
  Trophy, 
  User, 
  Cpu, 
  ChevronRight, 
  Sparkles,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { Player, PieceType, Piece, Board, GameStatus, Difficulty, Move } from './types';
import { 
  createInitialBoard, 
  getAllLegalMoves, 
  simulateMove, 
  isKingInCheck, 
  canPromote, 
  getPromotedType,
  getOriginalType
} from './utils/shogiLogic';
import { getBestMove } from './utils/aiEngine';

// 駒名のマッピング（成る前と成った後）
const PIECE_NAMES: Record<PieceType, { full: string; short: string; charColor: string }> = {
  OU: { full: '王将', short: '王', charColor: 'text-stone-800' },
  GY: { full: '玉将', short: '玉', charColor: 'text-stone-800' },
  HI: { full: '飛車', short: '飛', charColor: 'text-stone-800' },
  RY: { full: '竜王', short: '竜', charColor: 'text-red-600 font-bold' },
  KA: { full: '角行', short: '角', charColor: 'text-stone-800' },
  UM: { full: '竜馬', short: '馬', charColor: 'text-red-600 font-bold' },
  KI: { full: '金将', short: '金', charColor: 'text-stone-800' },
  GI: { full: '銀将', short: '銀', charColor: 'text-stone-800' },
  NG: { full: '成銀', short: '全', charColor: 'text-red-600' },
  KE: { full: '桂馬', short: '桂', charColor: 'text-stone-800' },
  NK: { full: '成桂', short: '圭', charColor: 'text-red-600' },
  KY: { full: '香車', short: '香', charColor: 'text-stone-800' },
  NY: { full: '成香', short: '杏', charColor: 'text-red-600' },
  FU: { full: '歩兵', short: '歩', charColor: 'text-stone-800' },
  TO: { full: 'と金', short: 'と', charColor: 'text-red-600 font-bold' },
};

export default function App() {
  // ゲームステート
  const [status, setStatus] = useState<GameStatus>('title');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [board, setBoard] = useState<Board>([]);
  const [turn, setTurn] = useState<Player>('player');
  const [moveCount, setMoveCount] = useState<number>(0);
  
  // 持ち駒 (プレイヤー、AIそれぞれ)
  const [playerCaptured, setPlayerCaptured] = useState<Piece[]>([]);
  const [aiCaptured, setAiCaptured] = useState<Piece[]>([]);

  // 選択・ハイライト状態
  const [selectedSquare, setSelectedSquare] = useState<{ r: number; c: number } | null>(null);
  const [selectedCaptured, setSelectedCaptured] = useState<Piece | null>(null);
  const [highlightedSquares, setHighlightedSquares] = useState<{ r: number; c: number }[]>([]);

  // 成りダイアログ表示用の一時情報
  const [pendingMove, setPendingMove] = useState<Move | null>(null);
  const [showPromotionDialog, setShowPromotionDialog] = useState<boolean>(false);
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);

  // ルール・ヘルプモーダル
  const [showHelp, setShowHelp] = useState<boolean>(false);

  // 直前の一手の強調表示用
  const [lastMove, setLastMove] = useState<{ from: { r: number; c: number } | null; to: { r: number; c: number } } | null>(null);

  // ゲーム初期化
  const startGame = (diff: Difficulty) => {
    setDifficulty(diff);
    
    // プレイヤーと相手のどちらかの「王(OU)」の駒を「玉(GY)」にする
    const playerKingType: 'OU' | 'GY' = Math.random() < 0.5 ? 'GY' : 'OU';
    const aiKingType: 'OU' | 'GY' = playerKingType === 'GY' ? 'OU' : 'GY';
    setBoard(createInitialBoard(playerKingType, aiKingType));

    setPlayerCaptured([]);
    setAiCaptured([]);
    setSelectedSquare(null);
    setSelectedCaptured(null);
    setHighlightedSquares([]);
    setPendingMove(null);
    setShowPromotionDialog(false);
    setMoveCount(0);

    // 「玉」を所持している方を先攻（先手）にする
    const firstTurn: Player = playerKingType === 'GY' ? 'player' : 'ai';
    setTurn(firstTurn);

    setLastMove(null);
    setStatus('playing');
  };

  // 合法手の一覧を取得
  const currentLegalMoves = () => {
    if (turn === 'player') {
      return getAllLegalMoves(board, 'player', playerCaptured);
    } else {
      return getAllLegalMoves(board, 'ai', aiCaptured);
    }
  };

  // 手番が進んだ時の敗北・勝利チェック
  useEffect(() => {
    if (status !== 'playing') return;

    // 手数(500手)上限のチェック
    if (moveCount >= 500) {
      setStatus('draw');
      return;
    }

    // どちらかの王が盤面に存在しない場合の安全対策
    let aiKingExists = false;
    let playerKingExists = false;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const piece = board[r][c];
        if (piece && (piece.type === 'OU' || piece.type === 'GY')) {
          if (piece.owner === 'ai') aiKingExists = true;
          if (piece.owner === 'player') playerKingExists = true;
        }
      }
    }

    if (!aiKingExists) {
      setStatus('victory');
      return;
    }
    if (!playerKingExists) {
      setStatus('defeat');
      return;
    }

    // 詰みチェック（相手の手数に移る、または自分の手数における合法手ゼロチェック）
    const nextTurnMoves = getAllLegalMoves(board, turn, turn === 'player' ? playerCaptured : aiCaptured);
    if (nextTurnMoves.length === 0) {
      // 合法手がない ＝ 詰み
      if (turn === 'player') {
        setStatus('defeat');
      } else {
        setStatus('victory');
      }
      return;
    }

    // AIのターン
    if (turn === 'ai' && !isAiThinking) {
      triggerAiMove();
    }
  }, [board, turn, status]);

  // AIの思考
  const triggerAiMove = async () => {
    setIsAiThinking(true);
    try {
      const bestMove = await getBestMove(board, aiCaptured, playerCaptured, difficulty);
      if (bestMove) {
        // AIの移動を実行
        let nextAiCaptured = [...aiCaptured];
        let nextPlayerCaptured = [...playerCaptured];

        if (bestMove.from) {
          // 相手の駒を取った場合
          const target = board[bestMove.to.r][bestMove.to.c];
          if (target) {
            nextAiCaptured.push({
              ...target,
              type: getOriginalType(target.type), // 元の駒タイプに戻す
              isPromoted: false, // 持ち駒に戻るときは成る前の状態
              owner: 'ai',
            });
          }
        } else {
          // 持ち駒から打った場合、AIの持ち駒から削除
          const idx = nextAiCaptured.findIndex(p => p.id === bestMove.piece.id);
          if (idx !== -1) {
            nextAiCaptured.splice(idx, 1);
          }
        }

        // 成るべきか自動判定 (AIは基本強制的に成る必要があるときは成り、それ以外はスコアに従う)
        // bestMove.promote は既に aiEngine で最適化されている
        
        const nextBoard = simulateMove(board, bestMove);
        setBoard(nextBoard);
        setAiCaptured(nextAiCaptured);
        setPlayerCaptured(nextPlayerCaptured);
        setLastMove({ from: bestMove.from, to: bestMove.to });
        setMoveCount(prev => prev + 1);
        setTurn('player');
      } else {
        // AIが投了（実際には合法手が無い状態でuseEffectで判定されますが、念のため）
        setStatus('victory');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiThinking(false);
    }
  };

  // プレイヤーが盤上の駒を選択
  const handleSquareClick = (r: number, c: number) => {
    if (status !== 'playing' || turn !== 'player' || isAiThinking) return;

    // すでに移動先がハイライトされており、そこをクリックした場合は移動を実行
    const isDestination = highlightedSquares.some(sq => sq.r === r && sq.c === c);
    if (isDestination) {
      executePlayerMove(r, c);
      return;
    }

    // 新たに自分の駒を選択
    const piece = board[r][c];
    if (piece && piece.owner === 'player') {
      setSelectedCaptured(null);
      setSelectedSquare({ r, c });
      
      // 合法手からこの駒の移動先を抽出
      const moves = currentLegalMoves().filter(
        m => m.from && m.from.r === r && m.from.c === c
      );
      setHighlightedSquares(moves.map(m => m.to));
    } else {
      // リセット
      setSelectedSquare(null);
      setSelectedCaptured(null);
      setHighlightedSquares([]);
    }
  };

  // プレイヤーが持ち駒を選択
  const handleCapturedPieceClick = (piece: Piece) => {
    if (status !== 'playing' || turn !== 'player' || isAiThinking) return;

    setSelectedSquare(null);
    setSelectedCaptured(piece);

    // その持ち駒を打てる合法的マス
    const moves = currentLegalMoves().filter(
      m => m.from === null && m.piece.type === piece.type
    );
    setHighlightedSquares(moves.map(m => m.to));
  };

  // 移動の実行 (ダイアログ表示のハンドリング含む)
  const executePlayerMove = (tr: number, tc: number) => {
    let move: Move | null = null;

    if (selectedSquare) {
      // 盤上移動
      const fromPiece = board[selectedSquare.r][selectedSquare.c]!;
      // 成れるかどうかのチェック (移動。または移動元が敵陣＝行0,1,2)
      const enteredEnemyTerritory = tr <= 2;
      const startedInEnemyTerritory = selectedSquare.r <= 2;
      
      const eligibleToPromote = canPromote(fromPiece.type) && !fromPiece.isPromoted && (enteredEnemyTerritory || startedInEnemyTerritory);

      // 強制成り立つチェック（歩・香は一番奥の行0、桂馬は奥から2段行0,1で、これ以上進めなくなるため必ず成る必要がある）
      let mustPromote = false;
      if (eligibleToPromote) {
        if ((fromPiece.type === 'FU' || fromPiece.type === 'KY') && tr === 0) {
          mustPromote = true;
        }
        if (fromPiece.type === 'KE' && (tr === 0 || tr === 1)) {
          mustPromote = true;
        }
      }

      if (eligibleToPromote) {
        if (mustPromote) {
          // 強制「成る」
          move = {
            from: selectedSquare,
            to: { r: tr, c: tc },
            piece: fromPiece,
            promote: true,
          };
          confirmMove(move);
        } else {
          // 選択ダイアログを表示
          setPendingMove({
            from: selectedSquare,
            to: { r: tr, c: tc },
            piece: fromPiece,
          });
          setShowPromotionDialog(true);
        }
      } else {
        // 成りなし通常移動
        move = {
          from: selectedSquare,
          to: { r: tr, c: tc },
          piece: fromPiece,
          promote: false,
        };
        confirmMove(move);
      }
    } else if (selectedCaptured) {
      // 持ち駒からの配置
      move = {
        from: null,
        to: { r: tr, c: tc },
        piece: selectedCaptured,
      };
      confirmMove(move);
    }
  };

  // プレイヤーが成ることを確認
  const handlePromotionConfirm = (shouldPromote: boolean) => {
    if (pendingMove) {
      const finalMove = {
        ...pendingMove,
        promote: shouldPromote,
      };
      setPendingMove(null);
      setShowPromotionDialog(false);
      confirmMove(finalMove);
    }
  };

  // 手を確定して盤面・持ち駒を更新
  const confirmMove = (move: Move) => {
    let nextPlayerCaptured = [...playerCaptured];
    let nextAiCaptured = [...aiCaptured];

    if (move.from) {
      // 相手の駒があった場合は持ち駒に加える
      const target = board[move.to.r][move.to.c];
      if (target) {
        nextPlayerCaptured.push({
          ...target,
          type: getOriginalType(target.type), // 元の駒タイプに戻す
          isPromoted: false, // 持ち駒に戻るときは初期化
          owner: 'player',
        });
      }
    } else {
      // 持ち駒から打った場合は持ち駒から削除
      const idx = nextPlayerCaptured.findIndex(p => p.id === move.piece.id);
      if (idx !== -1) {
        nextPlayerCaptured.splice(idx, 1);
      }
    }

    const nextBoard = simulateMove(board, move);
    setBoard(nextBoard);
    setPlayerCaptured(nextPlayerCaptured);
    setAiCaptured(nextAiCaptured);
    setLastMove({ from: move.from, to: move.to });
    setMoveCount(prev => prev + 1);

    // 選択をクリア
    setSelectedSquare(null);
    setSelectedCaptured(null);
    setHighlightedSquares([]);

    // ターン交代
    setTurn('ai');
  };

  // 難易度の日本語表記変換
  const getDifficultyLabel = (diff: Difficulty): string => {
    switch (diff) {
      case 'easy': return '簡単';
      case 'normal': return '普通';
      case 'hard': return '難しい';
      case 'pro': return 'プロ';
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col justify-between text-stone-900 font-sans relative overflow-hidden selection:bg-amber-100" id="game-root">
      {/* 背景のうすい和風格子テクスチャ */}
      <div className="absolute inset-0 bg-grid-slate-200 [mask-image:linear-gradient(0deg,#fff,rgba(255,255,255,0.6))] pointer-events-none" />

      {/* ヘッダー */}
      <header className="bg-white border-b border-stone-200 py-3 px-6 shadow-xs flex justify-between items-center z-10" id="game-header">
        <div className="flex items-center gap-3">
          <div className="bg-amber-600 text-white p-1.5 rounded-lg">
            <span className="font-bold text-lg font-serif">将</span>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-stone-800">盤上遊戯</h1>
            <p className="text-xs text-stone-500">難易度選択テーブルゲーム</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowHelp(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-stone-50 border border-stone-200 text-sm font-medium text-stone-600 transition"
            id="btn-help"
          >
            <HelpCircle size={16} />
            <span>ルール</span>
          </button>
          
          {status !== 'title' && (
            <button 
              onClick={() => setStatus('title')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 border border-stone-200 text-sm font-medium text-stone-600 transition"
              id="btn-quit"
            >
              <RotateCw size={15} />
              <span>タイトルへ</span>
            </button>
          )}
        </div>
      </header>

      {/* メインエリア */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 flex flex-col justify-center items-center z-10 overflow-auto" id="game-main">
        
        {/* タイトル画面 */}
        {status === 'title' && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="max-w-xl w-full bg-white border border-stone-200 rounded-2xl p-8 shadow-md text-center flex flex-col items-center relative"
            id="title-panel"
          >
            <div className="absolute top-4 right-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
              <Sparkles size={12} />
              <span>2D Table Edition</span>
            </div>

            <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center text-amber-700 border-2 border-amber-200 font-serif font-black text-4xl mb-6 shadow-sm">
              将
            </div>
            
            <h2 className="text-2xl md:text-3xl font-extrabold text-stone-800 tracking-tight font-serif mb-2">
              盤上遊戯
            </h2>
            <p className="text-stone-500 text-sm max-w-sm mb-8 leading-relaxed">
              PC、スマートフォン両対応のシンプルな将棋ゲーム。難易度を選択して、目の前の対戦に挑みましょう。
            </p>

            <div className="w-full space-y-4" id="difficulty-selection">
              <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest text-left px-2">
                対戦難易度を選択
              </h3>
              
              <div className="grid grid-cols-2 gap-3">
                {(['easy', 'normal', 'hard', 'pro'] as Difficulty[]).map((diff) => {
                  let style = "border-stone-200 hover:border-amber-300 hover:bg-amber-50/50";
                  let badge = "bg-stone-100 text-stone-600";
                  let desc = "";

                  if (diff === 'easy') {
                    desc = "ランダム傾向の弱いAI";
                    badge = "bg-green-100 text-green-800";
                  } else if (diff === 'normal') {
                    desc = "標準的な対局思考";
                    badge = "bg-blue-100 text-blue-800";
                  } else if (diff === 'hard') {
                    desc = "数手先を読んで攻める";
                    badge = "bg-indigo-100 text-indigo-800";
                  } else if (diff === 'pro') {
                    desc = "最高最善の手を探索する";
                    badge = "bg-purple-100 text-purple-800";
                  }

                  return (
                    <button
                      key={diff}
                      onClick={() => startGame(diff)}
                      className={`flex flex-col items-start p-4 border rounded-xl text-left transition relative overflow-hidden group ${style}`}
                      id={`diff-btn-${diff}`}
                    >
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mb-2 ${badge}`}>
                        {getDifficultyLabel(diff)}
                      </span>
                      <span className="text-xs text-stone-500 font-normal group-hover:text-stone-700">
                        {desc}
                      </span>
                      <ChevronRight size={16} className="absolute right-4 bottom-4 text-stone-300 group-hover:text-amber-500 transition-transform group-hover:translate-x-1" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-stone-100 w-full flex justify-between text-xs text-stone-400">
              <span>手数上限: 500手</span>
              <span>特殊規則: 二歩 / 打ち歩詰め / 行き所のない駒 禁止</span>
            </div>
          </motion.div>
        )}

        {/* プレイ画面 */}
        {status !== 'title' && (
          <div className="w-full flex flex-col lg:flex-row gap-6 items-center lg:items-start justify-center max-w-5xl" id="play-container">
            
            {/* 情報サイドパネル (左 / 上) */}
            <div className="w-full lg:w-64 shrink-0 flex flex-col gap-4" id="info-panel">
              
              {/* 対局状況カード */}
              <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs">
                <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">対局情報</h3>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-1.5 border-b border-stone-100">
                    <span className="text-sm text-stone-500">難易度</span>
                    <span className="text-sm font-semibold text-stone-800 bg-stone-100 px-2.5 py-0.5 rounded-full">
                      {getDifficultyLabel(difficulty)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1.5 border-b border-stone-100">
                    <span className="text-sm text-stone-500">現在の手数</span>
                    <span className="text-sm font-mono font-bold text-stone-800">
                      {moveCount} / 500 手
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-sm text-stone-500">手番</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${turn === 'player' ? 'bg-amber-500 animate-pulse' : 'bg-stone-300'}`} />
                      <span className="text-sm font-bold text-stone-800">
                        {turn === 'player' ? 'あなた (先手)' : '敵AI (後手)'}
                      </span>
                    </div>
                  </div>
                </div>

                {isAiThinking && (
                  <div className="mt-4 bg-amber-50 border border-amber-100 rounded-lg p-2.5 flex items-center gap-2.5">
                    <RefreshCw className="animate-spin text-amber-600" size={16} />
                    <span className="text-xs font-medium text-amber-800">AIが思考しています...</span>
                  </div>
                )}
              </div>

              {/* AI持ち駒エリア */}
              <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1">
                    <Cpu size={14} />
                    <span>敵AIの持ち駒</span>
                  </span>
                  <span className="text-xs text-stone-500 font-mono">({aiCaptured.length})</span>
                </div>

                <div className="flex flex-wrap gap-1.5 min-h-12 bg-stone-50 p-2 rounded-lg border border-stone-200/50" id="ai-captured-box">
                  {aiCaptured.length === 0 ? (
                    <span className="text-xs text-stone-400 m-auto">なし</span>
                  ) : (
                    aiCaptured.map((piece) => (
                      <div
                        key={piece.id}
                        className="w-10 h-11 bg-stone-100 border border-stone-300 rounded flex items-center justify-center shadow-xs cursor-not-allowed select-none"
                        style={{ clipPath: 'polygon(50% 0%, 100% 25%, 85% 100%, 15% 100%, 0% 25%)' }}
                      >
                        <span className={`text-base leading-none font-serif ${PIECE_NAMES[piece.type].charColor}`}>
                          {PIECE_NAMES[piece.type].short}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* プレイヤー持ち駒エリア */}
              <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs border-amber-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-stone-500 uppercase tracking-widest flex items-center gap-1">
                    <User size={14} className="text-amber-600" />
                    <span>あなたの持ち駒</span>
                  </span>
                  <span className="text-xs text-amber-600 font-mono font-semibold">({playerCaptured.length})</span>
                </div>

                <div className="flex flex-wrap gap-1.5 min-h-12 bg-amber-50/20 p-2 rounded-lg border border-amber-100/30" id="player-captured-box">
                  {playerCaptured.length === 0 ? (
                    <span className="text-xs text-stone-400 m-auto">なし</span>
                  ) : (
                    playerCaptured.map((piece) => {
                      const isSelected = selectedCaptured?.id === piece.id;
                      return (
                        <button
                          key={piece.id}
                          disabled={turn !== 'player' || isAiThinking}
                          onClick={() => handleCapturedPieceClick(piece)}
                          className={`w-10 h-11 bg-amber-50 hover:bg-amber-100/80 border border-amber-300 rounded flex items-center justify-center shadow-xs select-none transition-all active:scale-95 ${
                            isSelected ? 'ring-2 ring-amber-500 bg-amber-200 duration-150' : ''
                          }`}
                          style={{ clipPath: 'polygon(50% 0%, 100% 25%, 85% 100%, 15% 100%, 0% 25%)' }}
                          id={`cap-${piece.id}`}
                        >
                          <span className={`text-base leading-none font-serif ${PIECE_NAMES[piece.type].charColor}`}>
                            {PIECE_NAMES[piece.type].short}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
                {selectedCaptured && (
                  <p className="text-[10px] text-amber-600 mt-2 font-medium">※ 盤面のハイライトされた空きマスを選択して配置できます。</p>
                )}
              </div>
            </div>

            {/* 将棋盤ステージ */}
            <div className="bg-amber-100/60 p-4 rounded-2xl border-4 border-stone-700 shadow-lg flex flex-col items-center" id="board-stage">
              
              {/* 列の番号 (後手視点、右から1~9) */}
              <div className="flex justify-between w-full max-w-[400px] md:max-w-[495px] px-1 mb-1" id="col-headers">
                {[9, 8, 7, 6, 5, 4, 3, 2, 1].map(n => (
                  <span key={n} className="text-center font-bold text-xs text-stone-500 w-[11%]">
                    {n}
                  </span>
                ))}
              </div>

              <div className="flex" id="board-grid-wrapper">
                {/* 行の漢数字 (上から一〜九) */}
                <div className="flex flex-col justify-around py-1 mr-1.5" id="row-headers">
                  {['一', '二', '三', '四', '五', '六', '七', '八', '九'].map((h, i) => (
                    <span key={i} className="text-center font-bold text-xs text-stone-500 h-[11%] flex items-center">
                      {h}
                    </span>
                  ))}
                </div>

                {/* 9 x 9 マス目 */}
                <div className="grid grid-cols-9 bg-stone-700 p-0.5 gap-px rounded shadow-inner" style={{ width: 'min(90vw, 450px)', height: 'min(90vw, 450px)' }} id="shogi-board-cells">
                  {board.map((rowArr, r) => 
                    rowArr.map((piece, c) => {
                      const isHighlighted = highlightedSquares.some(sq => sq.r === r && sq.c === c);
                      const isSelected = selectedSquare?.r === r && selectedSquare?.c === c;
                      const isLastMoveDestination = lastMove?.to.r === r && lastMove?.to.c === c;
                      const isLastMoveOrigin = lastMove?.from?.r === r && lastMove?.from?.c === c;

                      // マスのバックグラウンド色決定
                      let bgColor = "bg-amber-100 hover:bg-amber-50/70";
                      if (isSelected) {
                        bgColor = "bg-amber-300 ring-2 ring-amber-600 ring-inset";
                      } else if (isHighlighted) {
                        bgColor = "bg-emerald-200/90 hover:bg-emerald-300 cursor-pointer";
                      } else if (isLastMoveDestination || isLastMoveOrigin) {
                        bgColor = "bg-amber-200/80";
                      }

                      return (
                        <div
                          key={`${r}-${c}`}
                          onClick={() => (isHighlighted || (piece && piece.owner === 'player')) && handleSquareClick(r, c)}
                          className={`relative aspect-square flex items-center justify-center transition-colors select-none ${bgColor} ${
                            isHighlighted ? 'cursor-pointer' : (piece && piece.owner === 'player' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default')
                          }`}
                          id={`sq-${r}-${c}`}
                        >
                          {/* 将棋盤の四点(星)の描画 (3x3間隔用) */}
                          {((r === 2 || r === 6) && (c === 2 || c === 6)) && (
                            <div className="absolute w-1.5 h-1.5 bg-stone-400 rounded-full z-0 opacity-60" />
                          )}

                          {/* 駒 */}
                          {piece && (
                            <div
                              className={`w-[85%] h-[90%] bg-amber-50 border border-stone-300 rounded shadow-xs flex items-center justify-center z-10 transition-transform ${
                                piece.owner === 'ai' ? 'rotate-180' : ''
                              }`}
                              style={{ clipPath: 'polygon(50% 0%, 100% 25%, 85% 100%, 15% 100%, 0% 25%)' }}
                            >
                              <span className={`text-[13px] md:text-lg leading-none font-serif select-none ${PIECE_NAMES[piece.type].charColor}`}>
                                {PIECE_NAMES[piece.type].short}
                              </span>
                            </div>
                          )}

                          {/* ハイライトされた「打つ・動く」指標 */}
                          {isHighlighted && !piece && (
                            <div className="absolute w-3 h-3 bg-emerald-500 rounded-full z-20 opacity-70" />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* フッター */}
      <footer className="bg-white border-t border-stone-200 py-3 text-center text-xs text-stone-500 z-10" id="game-footer">
        © 2026 盤上遊戯 ── 精緻なる思考の戦い
      </footer>

      {/* 成る選択の承認ダイアログ */}
      <AnimatePresence>
        {showPromotionDialog && pendingMove && (
          <div className="fixed inset-0 bg-stone-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-40" id="promotion-modal">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-stone-200 rounded-2xl max-w-sm w-full p-6 shadow-xl text-center"
            >
              <div className="w-12 h-12 bg-amber-50 border border-amber-200 text-amber-700 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold font-serif">
                成
              </div>
              <h3 className="text-lg font-bold text-stone-800 font-serif mb-2">駒を「成る」ことができます</h3>
              <p className="text-sm text-stone-500 mb-6 font-normal">
                {PIECE_NAMES[pendingMove.piece.type].full} を{' '}
                <span className="font-bold text-red-600">
                  {PIECE_NAMES[getPromotedType(pendingMove.piece.type)].full}
                </span>{' '}
                にパワーアップさせますか？
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handlePromotionConfirm(false)}
                  className="flex-1 px-4 py-2 border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 text-sm font-medium rounded-lg transition"
                  id="promo-no"
                >
                  成らない
                </button>
                <button
                  type="button"
                  onClick={() => handlePromotionConfirm(true)}
                  className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg shadow-sm transition"
                  id="promo-yes"
                >
                  成る
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 対局終了ダイアログ （勝敗・引き分け） */}
      <AnimatePresence>
        {(status === 'victory' || status === 'defeat' || status === 'draw') && (
          <div className="fixed inset-0 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="game-over-modal">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white border-2 border-stone-300 rounded-2xl max-w-md w-full p-8 shadow-2xl text-center flex flex-col items-center"
            >
              {status === 'victory' && (
                <>
                  <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
                    <Trophy size={36} />
                  </div>
                  <h3 className="text-2xl font-bold text-stone-800 font-serif mb-2">対局終了：勝利！</h3>
                  <p className="text-stone-500 text-sm mb-6 leading-relaxed">
                    見事、敵AI（難易度: {getDifficultyLabel(difficulty)}）の王将を取り、勝利を収めました。<br />
                    （手数: {moveCount} 手）
                  </p>
                </>
              )}

              {status === 'defeat' && (
                <>
                  <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                    <AlertCircle size={36} />
                  </div>
                  <h3 className="text-2xl font-bold text-stone-800 font-serif mb-2">対局終了：敗北</h3>
                  <p className="text-stone-500 text-sm mb-6 leading-relaxed">
                    王将を取られ、敵AI（難易度: {getDifficultyLabel(difficulty)}）に敗北しました。<br />
                    悔しさをバネに、再度挑戦しましょう。
                  </p>
                </>
              )}

              {status === 'draw' && (
                <>
                  <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                    <RefreshCw size={36} />
                  </div>
                  <h3 className="text-2xl font-bold text-stone-800 font-serif mb-2">対局終了：引き分け</h3>
                  <p className="text-stone-500 text-sm mb-6 leading-relaxed">
                    500手に達したため、対局を引き分けとし、対戦を終了します。
                  </p>
                </>
              )}

              <button
                type="button"
                onClick={() => setStatus('title')}
                className="w-full px-5 py-3 bg-stone-800 hover:bg-stone-700 text-white text-sm font-semibold rounded-xl shadow-md transition"
                id="btn-restart-game"
              >
                タイトルへ戻る
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ルール・ヘルプモーダル */}
      <AnimatePresence>
        {showHelp && (
          <div className="fixed inset-0 bg-stone-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50" id="rule-modal">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-stone-200 rounded-2xl max-w-lg w-full p-6 shadow-xl flex flex-col max-h-[85vh]"
            >
              <div className="flex justify-between items-center pb-3 border-b border-stone-100 mb-4">
                <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2">
                  <HelpCircle size={20} className="text-amber-500" />
                  <span>ゲームルールと解説</span>
                </h3>
                <button
                  onClick={() => setShowHelp(false)}
                  className="text-stone-400 hover:text-stone-600 text-xl font-bold cursor-pointer p-1"
                >
                  &times;
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-4 text-sm text-stone-600 leading-relaxed font-normal" id="rule-content-body">
                <div>
                  <h4 className="font-bold text-stone-800 text-base mb-1">■ 目的</h4>
                  <p>交互に一手ずつ駒を動かし、相手の「王将」を先に取った側が勝利となります。</p>
                </div>

                <div>
                  <h4 className="font-bold text-stone-800 text-base mb-1">■ 駒の再配置（持ち駒）</h4>
                  <p>相手から取った駒は「あなたの持ち駒」パネルに保管されます。自分の番に、盤上の空いているマスをどこでもクリックして再配置（打つ）することができます。</p>
                </div>

                <div>
                  <h4 className="font-bold text-stone-800 text-base mb-1">■ 特殊・禁止ルール</h4>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>
                      <span className="font-bold text-stone-800">二歩（にふ）の禁止：</span>
                      既に自分の「成っていない歩」が存在する縦の列に、新たに持ち駒から「歩」を打つことはできません。
                    </li>
                    <li>
                      <span className="font-bold text-stone-800">打ち歩詰め（うちふづめ）の禁止：</span>
                      持ち駒の「歩」を打って、直接相手の「王将」を詰みの状態にすることはできません。
                    </li>
                    <li>
                      <span className="font-bold text-stone-800">行き所のない駒の禁止：</span>
                      これ以上進むことができなくなるような配置（一番奥の行に「歩」や「香車」を置いたり、奥から2段以内に「桂馬」を置いたりする行為）は禁止となります。
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-stone-800 text-base mb-1">■ 成る（パワーアップ）</h4>
                  <p>自分の駒が敵陣（奥の3段）に入ったり、敵陣から移動する時にパワーアップ（成る）できます。「成る」と、動き方が強力に変化します（成る・成らないの選択が行えます）。</p>
                </div>

                <div>
                  <h4 className="font-bold text-stone-800 text-base mb-1">■ 対局時間と終了</h4>
                  <p>プレイヤーと敵AIによる移動を合計して、最大 **500手** で対局が引き分けとなります。</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-stone-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowHelp(false)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-semibold rounded-lg transition"
                >
                  閉じる
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
