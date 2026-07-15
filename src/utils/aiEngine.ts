import { Board, Move, Piece, Difficulty } from '../types';
import { getAllLegalMoves, simulateMove, getPieceCostValue, getPromotedType, getOriginalType } from './shogiLogic';

// 盤面評価関数
export function evaluateBoard(board: Board, aiCaptured: Piece[], playerCaptured: Piece[]): number {
  let score = 0;

  // 1. 盤上の駒価値
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const piece = board[r][c];
      if (piece) {
        const val = getPieceCostValue(piece.type);
        if (piece.owner === 'ai') {
          score += val;
          // 位置ボーナス (攻めやすさ: 奥に行くほどプレイヤー王に近づくため、プレイヤー王の位置を探すか、単に下に向かうのを少し優遇)
          // AIは下方向（行インデックス増）に進む
          score += r * 5; 
        } else {
          score -= val;
          // プレイヤーの駒が上方向（行インデックス減）に進む
          score -= (8 - r) * 5;
        }
      }
    }
  }

  // 2. 持ち駒価値
  for (const p of aiCaptured) {
    score += getPieceCostValue(p.type) * 0.9; // 持ち駒は少し割引
  }
  for (const p of playerCaptured) {
    score -= getPieceCostValue(p.type) * 0.9;
  }

  return score;
}

// 思考プロセスをシミュレートするメインの関数
export async function getBestMove(
  board: Board,
  aiCaptured: Piece[],
  playerCaptured: Piece[],
  difficulty: Difficulty
): Promise<Move | null> {
  const legalMoves = getAllLegalMoves(board, 'ai', aiCaptured);

  if (legalMoves.length === 0) {
    return null; // 指せる手がない
  }

  // ミニ遅延（思考している感じを演出するため、要求仕様の速さに合わせる）
  let delay = 300;
  if (difficulty === 'normal') delay = 700;
  if (difficulty === 'hard') delay = 1300;
  if (difficulty === 'pro') delay = 2000;

  await new Promise(resolve => setTimeout(resolve, delay));

  switch (difficulty) {
    case 'easy':
      return getEasyMove(legalMoves, board, aiCaptured, playerCaptured);
    case 'normal':
      return getNormalMove(legalMoves, board, aiCaptured, playerCaptured);
    case 'hard':
      return getMinimaxMove(legalMoves, board, aiCaptured, playerCaptured, 2); // 深さ2
    case 'pro':
      return getMinimaxMove(legalMoves, board, aiCaptured, playerCaptured, 3); // 深さ3
    default:
      return legalMoves[Math.floor(Math.random() * legalMoves.length)];
  }
}

// Easy：基本ランダム。30%の確率で、敵を奪える最適な手があれば選ぶ
function getEasyMove(
  legalMoves: Move[],
  board: Board,
  aiCaptured: Piece[],
  playerCaptured: Piece[]
): Move {
  const capMoves = legalMoves.filter(m => m.from && board[m.to.r][m.to.c] !== null);
  
  if (capMoves.length > 0 && Math.random() < 0.4) {
    // 相手の駒を奪える手を選択
    capMoves.sort((a, b) => {
      const pA = board[a.to.r][a.to.c];
      const pB = board[b.to.r][b.to.c];
      const valA = pA ? getPieceCostValue(pA.type) : 0;
      const valB = pB ? getPieceCostValue(pB.type) : 0;
      return valB - valA;
    });
    return capMoves[0];
  }

  // それ以外はランダム
  return legalMoves[Math.floor(Math.random() * legalMoves.length)];
}

// Normal: 1手先を読んで最も盤面評価値が高い手を選ぶ（1手読み greedy）
function getNormalMove(
  legalMoves: Move[],
  board: Board,
  aiCaptured: Piece[],
  playerCaptured: Piece[]
): Move {
  let bestScore = -Infinity;
  let bestMoves: Move[] = [];

  for (const m of legalMoves) {
    // 駒を獲得したか
    let nextAiCap = [...aiCaptured];
    let nextPlayerCap = [...playerCaptured];
    let capturedPiece: Piece | null = null;
    
    if (m.from) {
      capturedPiece = board[m.to.r][m.to.c];
    }
    
    if (capturedPiece) {
      nextAiCap.push({
        ...capturedPiece,
        type: getOriginalType(capturedPiece.type), // 元の駒タイプに戻す
        isPromoted: false, // 持ち駒に戻るときは初期状態に戻る
        owner: 'ai', // 所有者を書き換え
      });
    }

    const nextBoard = simulateMove(board, m);
    const score = evaluateBoard(nextBoard, nextAiCap, nextPlayerCap);

    if (score > bestScore) {
      bestScore = score;
      bestMoves = [m];
    } else if (score === bestScore) {
      bestMoves.push(m);
    }
  }

  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

// Hard & Pro: ミニマックス法（Alpha-Beta枝刈り）
function getMinimaxMove(
  legalMoves: Move[],
  board: Board,
  aiCaptured: Piece[],
  playerCaptured: Piece[],
  depth: number
): Move {
  let bestMove = legalMoves[0];
  let bestScore = -Infinity;

  // アルファ・ベータ探索の初期値を設定
  let alpha = -Infinity;
  let beta = Infinity;

  // 後手(AI)の最初の手（最大化）
  for (const m of legalMoves) {
    let nextAiCap = [...aiCaptured];
    let nextPlayerCap = [...playerCaptured];
    let capturedPiece: Piece | null = null;
    if (m.from) {
      capturedPiece = board[m.to.r][m.to.c];
    }
    if (capturedPiece) {
      nextAiCap.push({
        ...capturedPiece,
        type: getOriginalType(capturedPiece.type), // 元の駒タイプに戻す
        isPromoted: false,
        owner: 'ai',
      });
    }

    const nextBoard = simulateMove(board, m);
    // 相手が最善手を指してくるという仮定で先を読む
    const score = minimax(
      nextBoard,
      depth - 1,
      false, // 次はプレイヤーの番（最小化）
      alpha,
      beta,
      nextAiCap,
      nextPlayerCap
    );

    if (score > bestScore) {
      bestScore = score;
      bestMove = m;
    }
    alpha = Math.max(alpha, score);
  }

  return bestMove;
}

function minimax(
  board: Board,
  depth: number,
  isMaximizing: boolean,
  alpha: number,
  beta: number,
  aiCaptured: Piece[],
  playerCaptured: Piece[]
): number {
  // 深さがゼロか、ゲームが終了しているか（どちらかの王がいないなど）
  let containsAiKing = false;
  let containsPlayerKing = false;

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r][c];
      if (p && p.type === 'OU') {
        if (p.owner === 'ai') containsAiKing = true;
        if (p.owner === 'player') containsPlayerKing = true;
      }
    }
  }

  if (!containsAiKing) return -9999999; // AI敗北
  if (!containsPlayerKing) return 9999999; // AI勝利

  if (depth === 0) {
    return evaluateBoard(board, aiCaptured, playerCaptured);
  }

  if (isMaximizing) {
    // AIのターン
    let maxEval = -Infinity;
    const moves = getAllLegalMoves(board, 'ai', aiCaptured);
    if (moves.length === 0) return -9999999; // 指せなければ負け（詰み）

    for (const m of moves) {
      let nextAiCap = [...aiCaptured];
      let capturedPiece = m.from ? board[m.to.r][m.to.c] : null;
      if (capturedPiece) {
        nextAiCap.push({ ...capturedPiece, type: getOriginalType(capturedPiece.type), isPromoted: false, owner: 'ai' });
      }

      const nextBoard = simulateMove(board, m);
      const score = minimax(nextBoard, depth - 1, false, alpha, beta, nextAiCap, playerCaptured);
      maxEval = Math.max(maxEval, score);
      alpha = Math.max(alpha, score);
      if (beta <= alpha) break; // 枝刈り
    }
    return maxEval;
  } else {
    // プレイヤーのターン（最小化）
    let minEval = Infinity;
    const moves = getAllLegalMoves(board, 'player', playerCaptured);
    if (moves.length === 0) return 9999999; // 指せなければ勝ち（詰み）

    for (const m of moves) {
      let nextPlayerCap = [...playerCaptured];
      let capturedPiece = m.from ? board[m.to.r][m.to.c] : null;
      if (capturedPiece) {
        nextPlayerCap.push({ ...capturedPiece, type: getOriginalType(capturedPiece.type), isPromoted: false, owner: 'player' });
      }

      const nextBoard = simulateMove(board, m);
      const score = minimax(nextBoard, depth - 1, true, alpha, beta, aiCaptured, nextPlayerCap);
      minEval = Math.min(minEval, score);
      beta = Math.min(beta, score);
      if (beta <= alpha) break; // 枝刈り
    }
    return minEval;
  }
}
