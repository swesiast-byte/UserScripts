// ==UserScript==
// @name         Romance.io integration with Goodreads
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Get steam rating from Romance.io for Goodreads books using JSON API
// @author       swesiast
// @match        *://*.goodreads.com/book/show/*
// @grant        GM_xmlhttpRequest
// @connect      romance.io
// ==/UserScript==

(function() {
    'use strict';

    // Function to extract book title and author from Goodreads
    function getBookInfo() {
        let title, author;

        const titleSelectors = [
            'h1.Text__title1'
        ];

        const authorSelectors = [
            'span.ContributorLink__name'
        ];

        for (const selector of titleSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                title = element.textContent.trim();
                break;
            }
        }

        for (const selector of authorSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                author = element.textContent.trim();
                break;
            }
        }

        return { title, author };
    }

    function displaySteamRating(steamLevel) {
        const existingDisplay = document.getElementById('romance-io-steam-rating');
        if (existingDisplay) {
            existingDisplay.remove();
        }

        const display = document.createElement('div');
        display.id = 'romance-io-steam-rating';
        display.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff6b6b;
            color: white;
            padding: 15px;
            border-radius: 10px;
            z-index: 10000;
            font-family: Arial, sans-serif;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            max-width: 300px;
            border: 2px solid #ff5252;
        `;

        display.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 8px; font-size: 16px;">🔥 Rating</div>
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">${steamLevel}</div>
            <div style="font-size: 12px; opacity: 0.9;">From Romance.io</div>
        `;

        document.body.appendChild(display);
        display.addEventListener('click', function() {
            display.remove();
        });
    }

    // Function to search Romance.io using JSON API
    function searchRomanceIO(title, author) {
        const cleanTitle = encodeURIComponent(title.trim());

        const jsonUrl = `https://www.romance.io/json/search_books?search=${cleanTitle}`;

        console.log('🔍 Searching Romance.io via JSON:', jsonUrl);

        // Add loading indicator
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'romance-io-loading';
        loadingDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4ecdc4;
            color: white;
            padding: 15px;
            border-radius: 10px;
            z-index: 10000;
            font-family: Arial, sans-serif;
            font-size: 14px;
        `;
        loadingDiv.innerHTML = '🔍 Searching Romance.io...';
        document.body.appendChild(loadingDiv);

        GM_xmlhttpRequest({
            method: 'GET',
            url: jsonUrl,
            onload: function(response) {
                console.log('✅ JSON API request completed');

                const loading = document.getElementById('romance-io-loading');
                if (loading) loading.remove();

                if (response.status === 200) {
                    try {
                        const data = JSON.parse(response.responseText);
                        console.log(`📚 Found ${data.books ? data.books.length : 0} books`);

                        if (data.books && data.books.length > 0) {
                            // Find the book that matches both title and author
                            const matchedBook = findMatchingBook(data.books, title, author);

                            if (matchedBook) {
                                console.log('✅ Found matching book:', matchedBook.title);
                                fetchBookSteamRating(matchedBook.url);
                            } else {
                                console.log('❌ No exact match found, using first result');
                                fetchBookSteamRating(data.books[0].url);
                            }
                        } else {
                            displaySteamRating('No books found');
                        }
                    } catch (e) {
                        console.error('❌ JSON parse error:', e);
                        displaySteamRating('JSON Parse Error');
                    }
                } else {
                    console.error('❌ HTTP Error:', response.status);
                    displaySteamRating('API Error: ' + response.status);
                }
            },
            onerror: function(error) {
                console.error('❌ GM_xmlhttpRequest error:', error);
                const loading = document.getElementById('romance-io-loading');
                if (loading) loading.remove();
                displaySteamRating('Network Error');
            }
        });
    }

    // Function to find the best matching book by author
    function findMatchingBook(books, goodreadsTitle, goodreadsAuthor) {
        // Clean the author name for comparison
        const cleanGoodreadsAuthor = goodreadsAuthor.toLowerCase().trim();

        console.log(`🔍 Looking for author: "${cleanGoodreadsAuthor}"`);

        // First, try exact author match
        for (const book of books) {
            if (book.authors && book.authors.length > 0) {
                const romanceAuthor = book.authors[0].name.toLowerCase().trim();
                console.log(`   Comparing with: "${romanceAuthor}"`);

                if (romanceAuthor === cleanGoodreadsAuthor) {
                    console.log('✅ Exact author match found');
                    return book;
                }
            }
        }

        // Fallback: partial author match
        for (const book of books) {
            if (book.authors && book.authors.length > 0) {
                const romanceAuthor = book.authors[0].name.toLowerCase().trim();
                if (romanceAuthor.includes(cleanGoodreadsAuthor) || cleanGoodreadsAuthor.includes(romanceAuthor)) {
                    console.log('✅ Partial author match found');
                    return book;
                }
            }
        }

        // Last resort: check if author name contains any part
        const authorParts = cleanGoodreadsAuthor.split(' ');
        for (const book of books) {
            if (book.authors && book.authors.length > 0) {
                const romanceAuthor = book.authors[0].name.toLowerCase().trim();
                for (const part of authorParts) {
                    if (part.length > 2 && romanceAuthor.includes(part)) {
                        console.log('✅ Author name part match found');
                        return book;
                    }
                }
            }
        }

        return null;
    }

    // Function to fetch steam rating from individual book page
    function fetchBookSteamRating(bookPath) {
        const bookUrl = `https://www.romance.io${bookPath}`;
        console.log('📖 Fetching book page:', bookUrl);

        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'romance-io-loading';
        loadingDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4ecdc4;
            color: white;
            padding: 15px;
            border-radius: 10px;
            z-index: 10000;
            font-family: Arial, sans-serif;
            font-size: 14px;
        `;
        loadingDiv.innerHTML = '📖 Loading book details...';
        document.body.appendChild(loadingDiv);

        GM_xmlhttpRequest({
            method: 'GET',
            url: bookUrl,
            onload: function(response) {
                console.log('✅ Book page request completed');

                const loading = document.getElementById('romance-io-loading');
                if (loading) loading.remove();

                if (response.status === 200) {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(response.responseText, 'text/html');

                    const steamRating = extractSteamRating(doc);
                    if (steamRating) {
                        displaySteamRating(steamRating);
                    } else {
                        displaySteamRating('Steam rating not found');
                        console.log('Could not find steam rating on book page');
                    }
                } else {
                    displaySteamRating('Book page error: ' + response.status);
                }
            },
            onerror: function(error) {
                console.error('❌ Book page request error:', error);
                const loading = document.getElementById('romance-io-loading');
                if (loading) loading.remove();
                displaySteamRating('Book page load error');
            }
        });
    }

    // Function to extract steam rating from book page
    function extractSteamRating(doc) {
        console.log('🔍 Extracting steam rating from book page...');

        const steamSelectors = [
            '[class*="steam-rating"]'
        ];

        for (const selector of steamSelectors) {
            try {
                const elements = doc.querySelectorAll(selector);
                console.log('steam elements,' , elements);
                for (const element of elements) {
                    const text = element.textContent.trim();
                    if (text.includes('steam')) {
                        console.log('🔥 Found steam element:', text);
                        return text;
                    }
                }
            } catch (e) {
                // Skip invalid selectors
            }
        }

        return null;
    }

    // Main function
    function main() {
        const bookInfo = getBookInfo();

        if (bookInfo.title && bookInfo.author) {
            console.log('📖 Goodreads book:', bookInfo.title, 'by', bookInfo.author);
            setTimeout(() => {
                searchRomanceIO(bookInfo.title, bookInfo.author);
            }, 1000);
        } else {
            console.log('Could not extract book information from Goodreads');
        }
    }

    // Run when page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }

})();
