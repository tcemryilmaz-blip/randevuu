// Kısayollar. Asıl değerler config/tema.ts içindedir; burada yalnızca kısa adlarla dışa açılır.
// Nesneler aynı referanstır: uzaktan ayar yüklendiğinde buradan okuyanlar da yeni değeri görür.

import { tema } from '@/config/tema';

export const colors = tema.renk;
export const fonts = tema.yazi;
export { tema };
