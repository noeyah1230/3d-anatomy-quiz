declare module 'virtual:approved-quiz' {
  export const assetSha256: string;
  export const questions: readonly import('./questions').Question[];
}
