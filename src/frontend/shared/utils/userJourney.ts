export function isStandaloneMode(): boolean {
  return new URLSearchParams(window.location.search).get('user-journey') !== 'widget';
}
