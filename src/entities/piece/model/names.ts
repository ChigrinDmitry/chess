import type { Color, PieceType } from '@/entities/game/@x/piece'

const NAMES: Record<Color, Record<PieceType, string>> = {
  w: {
    p: 'белая пешка',
    n: 'белый конь',
    b: 'белый слон',
    r: 'белая ладья',
    q: 'белый ферзь',
    k: 'белый король',
  },
  b: {
    p: 'чёрная пешка',
    n: 'чёрный конь',
    b: 'чёрный слон',
    r: 'чёрная ладья',
    q: 'чёрный ферзь',
    k: 'чёрный король',
  },
}

/** Название фигуры для скринридера: «белая пешка». */
export function pieceName(color: Color, type: PieceType): string {
  return NAMES[color][type]
}
