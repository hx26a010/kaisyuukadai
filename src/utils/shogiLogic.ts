import { Player, PieceType, Piece, Board, Move } from '../types';

// 駒の生成関数
export function createPiece(type: PieceType, owner: Player): Piece {
  return {
    id: `${owner}-${type}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    owner,
    isPromoted: isAlreadyPromoted(type),
  };
}

function isAlreadyPromoted(type: PieceType): boolean {
  return ['RY', 'UM', 'NG', 'NK', 'NY', 'TO'].includes(type);
}

// 駒が成れる種類かどうか
export function canPromote(type: PieceType): boolean {
  return ['FU', 'KY', 'KE', 'GI', 'KA', 'HI'].includes(type);
}

// 成った後の駒タイプを取得
export function getPromotedType(type: PieceType): PieceType {
  switch (type) {
    case 'FU': return 'TO';
    case 'KY': return 'NY';
    case 'KE': return 'NK';
    case 'GI': return 'NG';
    case 'KA': return 'UM';
    case 'HI': return 'RY';
    default: return type;
  }
}

// 成る前の元の駒タイプを取得
export function getOriginalType(type: PieceType): PieceType {
  switch (type) {
    case 'TO': return 'FU';
    case 'NY': return 'KY';
    case 'NK': return 'KE';
    case 'NG': return 'GI';
    case 'UM': return 'KA';
    case 'RY': return 'HI';
    default: return type;
  }
}

// 初期盤面の作成
export function createInitialBoard(playerKing: 'OU' | 'GY' = 'OU', aiKing: 'OU' | 'GY' = 'GY'): Board {
  const board: Board = Array(9).fill(null).map(() => Array(9).fill(null));

  // AI側 (奥: 行0,1,2)
  const aiRow0: PieceType[] = ['KY', 'KE', 'GI', 'KI', aiKing, 'KI', 'GI', 'KE', 'KY'];
  for (let c = 0; c < 9; c++) {
    board[0][c] = createPiece(aiRow0[c], 'ai');
  }
  // 飛車角 (AIから見て対称に)
  board[1][1] = createPiece('HI', 'ai');
  board[1][7] = createPiece('KA', 'ai');
  for (let c = 0; c < 9; c++) {
    board[2][c] = createPiece('FU', 'ai');
  }

  // プレイヤー側 (手前: 行6,7,8)
  for (let c = 0; c < 9; c++) {
    board[6][c] = createPiece('FU', 'player');
  }
  board[7][1] = createPiece('KA', 'player');
  board[7][7] = createPiece('HI', 'player');

  const playerRow8: PieceType[] = ['KY', 'KE', 'GI', 'KI', playerKing, 'KI', 'GI', 'KE', 'KY'];
  for (let c = 0; c < 9; c++) {
    board[8][c] = createPiece(playerRow8[c], 'player');
  }

  return board;
}

// 盤面外チェック
export function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < 9 && c >= 0 && c < 9;
}

// 駒の動きルール定義を取得
export function getPieceMoves(
  type: PieceType,
  owner: Player,
  r: number,
  c: number,
  board: Board
): { r: number; c: number }[] {
  const moves: { r: number; c: number }[] = [];
  const dir = owner === 'player' ? -1 : 1; // プレイヤーは上(-1), AIは下(+1)

  // 直線移動 (スライド) 用のヘルパー
  const addSlideMoves = (dr: number, dc: number) => {
    let nr = r + dr;
    let nc = c + dc;
    while (inBounds(nr, nc)) {
      const target = board[nr][nc];
      if (!target) {
        moves.push({ r: nr, c: nc });
      } else {
        if (target.owner !== owner) {
          moves.push({ r: nr, c: nc });
        }
        break; // 駒に当たったらそれ以上進めない
      }
      nr += dr;
      nc += dc;
    }
  };

  // 単独マス移動ヘルパー
  const addStepMove = (dr: number, dc: number) => {
    const nr = r + dr;
    const nc = c + dc;
    if (inBounds(nr, nc)) {
      const target = board[nr][nc];
      if (!target || target.owner !== owner) {
        moves.push({ r: nr, c: nc });
      }
    }
  };

  switch (type) {
    case 'FU': // 歩: 前に1マス
      addStepMove(dir, 0);
      break;

    case 'KY': // 香車: 前方にまっすぐ進める
      addSlideMoves(dir, 0);
      break;

    case 'KE': // 桂馬: 前方2マスの斜め左右
      addStepMove(dir * 2, -1);
      addStepMove(dir * 2, 1);
      break;

    case 'GI': // 銀: 前、前斜め、後斜めの5方向
      addStepMove(dir, 0);
      addStepMove(dir, -1);
      addStepMove(dir, 1);
      addStepMove(-dir, -1);
      addStepMove(-dir, 1);
      break;

    case 'KI':
    case 'TO':
    case 'NY':
    case 'NK':
    case 'NG': // 金、および歩・香・桂・銀の成った駒: 前、前斜め、左右、後ろの6方向
      addStepMove(dir, 0);
      addStepMove(dir, -1);
      addStepMove(dir, 1);
      addStepMove(0, -1);
      addStepMove(0, 1);
      addStepMove(-dir, 0);
      break;

    case 'KA': // 角: 斜め4方向スライド
      addSlideMoves(1, 1);
      addSlideMoves(1, -1);
      addSlideMoves(-1, 1);
      addSlideMoves(-1, -1);
      break;

    case 'UM': // 馬 (成角): 斜め4方向スライド + 上下左右1マス
      addSlideMoves(1, 1);
      addSlideMoves(1, -1);
      addSlideMoves(-1, 1);
      addSlideMoves(-1, -1);
      addStepMove(1, 0);
      addStepMove(-1, 0);
      addStepMove(0, 1);
      addStepMove(0, -1);
      break;

    case 'HI': // 飛車: 上下左右4方向スライド
      addSlideMoves(1, 0);
      addSlideMoves(-1, 0);
      addSlideMoves(0, 1);
      addSlideMoves(0, -1);
      break;

    case 'RY': // 竜 (成飛): 上下左右スライド + 斜め1マス
      addSlideMoves(1, 0);
      addSlideMoves(-1, 0);
      addSlideMoves(0, 1);
      addSlideMoves(0, -1);
      addStepMove(1, 1);
      addStepMove(1, -1);
      addStepMove(-1, 1);
      addStepMove(-1, -1);
      break;

    case 'OU': // 王: 周囲8方向1マス
    case 'GY': // 玉: 周囲8方向1マス
      addStepMove(1, 0);
      addStepMove(-1, 0);
      addStepMove(0, 1);
      addStepMove(0, -1);
      addStepMove(1, 1);
      addStepMove(1, -1);
      addStepMove(-1, 1);
      addStepMove(-1, -1);
      break;
  }

  return moves;
}

// 王手(Check)の判定
export function isKingInCheck(board: Board, player: Player): boolean {
  // playerの王の座標を探す
  let kingPos: { r: number; c: number } | null = null;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const piece = board[r][c];
      if (piece && (piece.type === 'OU' || piece.type === 'GY') && piece.owner === player) {
        kingPos = { r, c };
        break;
      }
    }
    if (kingPos) break;
  }

  if (!kingPos) return false; // 王が盤面にいない（取られた状態なら、既に負けですが）

  const opponent: Player = player === 'player' ? 'ai' : 'player';

  // 相手のあらゆる駒の移動範囲に、王の位置が含まれているかチェック
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const piece = board[r][c];
      if (piece && piece.owner === opponent) {
        const moves = getPieceMoves(piece.type, opponent, r, c, board);
        if (moves.some(m => m.r === kingPos!.r && m.c === kingPos!.c)) {
          return true;
        }
      }
    }
  }

  return false;
}

// 手を実行した仮想的な盤面を返す
export function simulateMove(board: Board, move: Move): Board {
  const nextBoard = board.map(row => [...row]);

  if (move.from) {
    // 盤面上の移動
    const piece = nextBoard[move.from.r][move.from.c];
    if (piece) {
      nextBoard[move.from.r][move.from.c] = null;
      const finalPiece = {
        ...piece,
        type: move.promote ? getPromotedType(piece.type) : piece.type,
        isPromoted: move.promote ? true : piece.isPromoted,
      };
      nextBoard[move.to.r][move.to.c] = finalPiece;
    }
  } else {
    // 持ち駒からの配置
    const cleanPiece = {
      ...move.piece,
      type: move.piece.type,
      isPromoted: false,
    };
    nextBoard[move.to.r][move.to.c] = cleanPiece;
  }

  return nextBoard;
}

// 持ち駒を配置できる（打てる）マスをすべて取得
export function getDropMoves(
  piece: Piece,
  board: Board,
  owner: Player
): { r: number; c: number }[] {
  const drops: { r: number; c: number }[] = [];

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      // 空きマスなら打つ候補
      if (board[r][c] === null) {
        // 行き所のない駒の判定
        if (piece.type === 'FU' || piece.type === 'KY') {
          if (owner === 'player' && r === 0) continue; // プレイヤーが一番奥に打つのは禁止
          if (owner === 'ai' && r === 8) continue; // AIが一番奥に打つのは禁止
        }
        if (piece.type === 'KE') {
          if (owner === 'player' && (r === 0 || r === 1)) continue; // プレイヤーが奥2段に打つのは禁止
          if (owner === 'ai' && (r === 7 || r === 8)) continue; // AIが奥2段に打つのは禁止
        }

        // 二歩の禁止
        if (piece.type === 'FU') {
          let hasUnpromotedFu = false;
          for (let row = 0; row < 9; row++) {
            const p = board[row][c];
            if (p && p.owner === owner && p.type === 'FU') {
              hasUnpromotedFu = true;
              break;
            }
          }
          if (hasUnpromotedFu) continue;
        }

        // ここで一旦打つのを許可（打ち歩詰めはこの後のバリデーションで弾く）
        drops.push({ r, c });
      }
    }
  }

  return drops;
}

// 所有している持ち駒（手駒）のリストを整理
export function getPieceCostValue(type: PieceType): number {
  switch (type) {
    case 'OU':
    case 'GY': return 10000;
    case 'HI': return 1000;
    case 'RY': return 1200;
    case 'KA': return 900;
    case 'UM': return 1100;
    case 'KI': return 600;
    case 'GI': return 500;
    case 'NG': return 600;
    case 'KE': return 400;
    case 'NK': return 500;
    case 'KY': return 300;
    case 'NY': return 500;
    case 'FU': return 100;
    case 'TO': return 500;
    default: return 0;
  }
}

// 打って相手の王が詰む（打ち歩詰め）を判定する
// 歩を持ち駒から打って、その手によって王が完全に詰み（チェックメイト）になること
export function isUchifuZume(
  board: Board,
  move: Move,
  owner: Player
): boolean {
  if (move.from !== null || move.piece.type !== 'FU') {
    return false; // 持ち駒から「歩」以外を打った場合は対象外
  }

  const opponent: Player = owner === 'player' ? 'ai' : 'player';

  // シミュレーション
  const nextBoard = simulateMove(board, move);

  // 打った歩の目の前が相手の王であり、王手がかかっているか
  if (!isKingInCheck(nextBoard, opponent)) {
    return false; // 王手がかかっていないなら打ち歩詰めではない
  }

  // 相手（王）に一切の合法手（王手を逃れる手）がないかをチェック
  const opponentMoves = getAllLegalMoves(nextBoard, opponent);
  if (opponentMoves.length === 0) {
    // 詰んでいる
    return true;
  }

  return false;
}

// 自殺手（王手が解けていない、あるいは王手になってしまう手）を除外した合法手
export function getAllLegalMoves(board: Board, owner: Player, captured: Piece[] = []): Move[] {
  const legalMoves: Move[] = [];

  // 1. 盤上の駒の移動
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const piece = board[r][c];
      if (piece && piece.owner === owner) {
        const primaryMoves = getPieceMoves(piece.type, owner, r, c, board);
        for (const m of primaryMoves) {
          // 移動先が「行き所のない駒」でないかチェック
          if (piece.type === 'FU' || piece.type === 'KY') {
            if (owner === 'player' && m.r === 0 && !canPromote(piece.type)) continue;
            if (owner === 'ai' && m.r === 8 && !canPromote(piece.type)) continue;
          }
          if (piece.type === 'KE') {
            if (owner === 'player' && (m.r === 0 || m.r === 1) && !canPromote(piece.type)) continue;
            if (owner === 'ai' && (m.r === 7 || m.r === 8) && !canPromote(piece.type)) continue;
          }

          // 「成る」選択肢があるか
          const enteredEnemyTerritory = owner === 'player' ? m.r <= 2 : m.r >= 6;
          const leftEnemyTerritory = owner === 'player' ? r <= 2 : r >= 6;
          const isEligibleToPromote = canPromote(piece.type) && !piece.isPromoted && (enteredEnemyTerritory || leftEnemyTerritory);

          // 強制的に成る必要性チェック（行き所のなくなる歩・香は0段目、桂は0,1段目で成る必要がある）
          let forcePromotion = false;
          if (isEligibleToPromote) {
            if (piece.type === 'FU' || piece.type === 'KY') {
              if (owner === 'player' && m.r === 0) forcePromotion = true;
              if (owner === 'ai' && m.r === 8) forcePromotion = true;
            }
            if (piece.type === 'KE') {
              if (owner === 'player' && (m.r === 0 || m.r === 1)) forcePromotion = true;
              if (owner === 'ai' && (m.r === 7 || m.r === 8)) forcePromotion = true;
            }
          }

          if (isEligibleToPromote) {
            // 成る場合の手
            const movePromote: Move = {
              from: { r, c },
              to: m,
              piece,
              promote: true,
            };
            // 仮想シミュレーション
            const sim = simulateMove(board, movePromote);
            if (!isKingInCheck(sim, owner)) {
              legalMoves.push(movePromote);
            }

            // 成らない場合の手（強制成りでない場合のみ）
            if (!forcePromotion) {
              const moveNoPromote: Move = {
                from: { r, c },
                to: m,
                piece,
                promote: false,
              };
              const simNP = simulateMove(board, moveNoPromote);
              if (!isKingInCheck(simNP, owner)) {
                legalMoves.push(moveNoPromote);
              }
            }
          } else {
            // 成り選択肢がない場合
            const moveNormal: Move = {
              from: { r, c },
              to: m,
              piece,
            };
            const sim = simulateMove(board, moveNormal);
            if (!isKingInCheck(sim, owner)) {
              legalMoves.push(moveNormal);
            }
          }
        }
      }
    }
  }

  // 2. 持ち駒の配置 (打つ)
  // uniqueな駒タイプごとに打つ
  const uniqueCaptured = captured.filter(
    (pc, idx, self) => self.findIndex(p => p.type === pc.type) === idx
  );

  for (const capPiece of uniqueCaptured) {
    const drops = getDropMoves(capPiece, board, owner);
    for (const d of drops) {
      const dropMove: Move = {
        from: null,
        to: d,
        piece: capPiece,
      };

      // 打ち歩詰めの禁止を検証
      if (isUchifuZume(board, dropMove, owner)) {
        continue;
      }

      // 自殺手のチェック（通常打つだけなら王手チェックはないが、王を盤面に置いて、王手が解けているか）
      const sim = simulateMove(board, dropMove);
      if (!isKingInCheck(sim, owner)) {
        legalMoves.push(dropMove);
      }
    }
  }

  return legalMoves;
}
