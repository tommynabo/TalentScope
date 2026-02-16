/**
 * Quick test to verify GitHub token is being loaded from environment
 */

console.log('=== GitHub Token Loading Test ===');
console.log('VITE_GITHUB_TOKEN:', import.meta.env.VITE_GITHUB_TOKEN);
console.log('Token exists:', !!import.meta.env.VITE_GITHUB_TOKEN);
console.log('Token length:', import.meta.env.VITE_GITHUB_TOKEN?.length || 0);
console.log('Token starts with ghp_:', import.meta.env.VITE_GITHUB_TOKEN?.startsWith('ghp_') ? 'YES ✅' : 'NO ❌');
