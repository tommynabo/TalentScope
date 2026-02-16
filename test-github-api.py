#!/usr/bin/env python3
"""
Test GitHub API search query directly to verify it works
"""

import requests
import json
import os

# GitHub token from environment
token = os.getenv('VITE_GITHUB_TOKEN', '')

print("=" * 60)
print("🧪 GitHub API Search Test")
print("=" * 60)

if token:
    print(f"✅ Token found: {token[:20]}...")
    headers = {
        'Authorization': f'token {token}',
        'Accept': 'application/vnd.github.v3+json'
    }
else:
    print("⚠️  No token found - using public API (limited to 60 req/hour)")
    headers = {
        'Accept': 'application/vnd.github.v3+json'
    }

# Test different search queries - from most permissive to restrictive
test_queries = [
    'language:dart stars:>=1 followers:>=1',  # Current
    'language:dart',  # Minimal
    'language:typescript stars:>=1 followers:>=1',  # Different language
    'language:typescript',  # Very minimal
]

for query in test_queries:
    print(f"\n📝 Testing query: {query}")
    
    try:
        response = requests.get(
            'https://api.github.com/search/users',
            params={
                'q': query,
                'per_page': 5,
                'sort': 'followers',
                'order': 'desc'
            },
            headers=headers,
            timeout=10
        )
        
        print(f"   Status: {response.status_code}")
        
        data = response.json()
        
        if response.status_code == 200:
            total_count = data.get('total_count', 0)
            items_count = len(data.get('items', []))
            print(f"   ✅ Total count: {total_count}")
            print(f"   ✅ Items returned: {items_count}")
            
            if items_count > 0:
                print(f"   ✅ First user: {data['items'][0]['login']}")
        else:
            print(f"   ❌ Error: {data.get('message', 'Unknown error')}")
            
    except Exception as e:
        print(f"   ❌ Exception: {str(e)}")

print("\n" + "=" * 60)
print("✨ Test completed")
print("=" * 60)
