// Crypto API Configuration
const COINMARKETCAP_API_KEY = 'YOUR_API_KEY'; // Replace with your API key
const CRYPTO_SYMBOLS = ['BTC', 'ETH', 'APT', 'SOL', 'ADA'];
const UPDATE_INTERVAL = 60000; // Update every minute

// Constants
const POLL_CATEGORIES = {
    governance: { id: 1, icon: 'landmark', label: 'Governance' },
    technical: { id: 2, icon: 'code', label: 'Technical' },
    economic: { id: 3, icon: 'chart-line', label: 'Economic' },
    general: { id: 0, icon: 'th-large', label: 'General' }
};

const POLL_STATUS = {
    ACTIVE: 0,
    ENDED: 1,
    CANCELLED: 2
};

// Contract Configuration
const CONTRACT_ADDRESS = '0x53a476e0017d801d2d77c5267f2b03fc78572664a417e8ae837b977ddc40a6fb';
const NETWORK = 'devnet';

// Contract ABI
const CONTRACT_ABI = [
    // Add your contract ABI here
    {
        "name": "createPoll",
        "type": "entry",
        "visibility": "public",
        "generic_type_params": [],
        "params": ["&signer", "vector<u8>", "vector<u8>", "u64", "u64"],
        "return": []
    },
    {
        "name": "vote",
        "type": "entry",
        "visibility": "public",
        "generic_type_params": [],
        "params": ["&signer", "u64"],
        "return": []
    },
    {
        "name": "getPolls",
        "type": "view",
        "visibility": "public",
        "generic_type_params": [],
        "params": [],
        "return": ["vector<Poll>"]
    }
];

// Wallet connection state
let wallet = null;
let walletAddress = null;
let isConnected = false;
let polls = [];

// DOM Elements
const connectWalletBtn = document.getElementById('connectWallet');
const disconnectWalletBtn = document.getElementById('disconnectWalletBtn');
const walletAddressDisplay = document.getElementById('walletAddress');
const createPollForm = document.getElementById('create-poll-form');
const pollsGrid = document.getElementById('pollsGrid');
const statsSection = document.getElementById('statsSection');
const categoryFilter = document.querySelector('.category-filter');
const sortPolls = document.getElementById('sort-polls');
const pollModal = document.getElementById('pollModal');
const closeModal = document.querySelector('.close-modal');

// Initialize the application
async function init() {
    await setupEventListeners();
    await checkWalletStatus();
    await loadPolls();
    setupCryptoData();
    setupFloatingIcons();
}

// Check if Petra wallet is installed
function checkPetraWallet() {
    if (!window.petra) {
        showError('Please install Petra Wallet to use this application');
        window.open('https://petra.app/', '_blank');
        return false;
    }
    return true;
}

// Connect wallet function
async function connectWallet() {
    if (!checkPetraWallet()) return;

    try {
        // Connect to wallet
        const response = await window.petra.connect();
        walletAddress = response.address;
        isConnected = true;

        // Update UI
        walletAddressDisplay.textContent = formatAddress(walletAddress);
        connectWalletBtn.style.display = 'none';
        disconnectWalletBtn.style.display = 'inline-flex';
        showSuccess('Wallet connected successfully!');

        // Load polls after connection
        await loadPolls();
    } catch (error) {
        console.error('Error connecting to wallet:', error);
        showError('Failed to connect wallet. Please try again.');
    }
}

// Disconnect wallet function
async function disconnectWallet() {
    try {
        if (window.petra) {
            await window.petra.disconnect();
            walletAddress = null;
            isConnected = false;

            // Update UI
            walletAddressDisplay.textContent = 'Not Connected';
            connectWalletBtn.style.display = 'inline-flex';
            disconnectWalletBtn.style.display = 'none';
            showSuccess('Wallet disconnected successfully!');

            // Reset poll count
            resetPollCount();
        }
    } catch (error) {
        console.error('Failed to disconnect wallet:', error);
        showError('Failed to disconnect wallet');
    }
}

// Check wallet status
async function checkWalletStatus() {
    try {
        if (window.petra) {
            const isConnected = await window.petra.isConnected();
            if (isConnected) {
                // Check network
                const network = await window.petra.network();
                if (network !== NETWORK) {
                    showError(`Please switch to ${NETWORK} network in your wallet`);
                    return;
                }

                const address = await window.petra.account();
                walletAddress = address;
                isConnected = true;
                walletAddressDisplay.textContent = formatAddress(address);
                connectWalletBtn.style.display = 'none';
                disconnectWalletBtn.style.display = 'inline-flex';
                await loadPolls();
            }
        }
    } catch (error) {
        console.error('Failed to check wallet status:', error);
    }
}

// Setup Event Listeners
function setupEventListeners() {
    if (createPollForm) {
        createPollForm.addEventListener('submit', handleCreatePoll);
    }
    if (connectWalletBtn) {
        connectWalletBtn.addEventListener('click', connectWallet);
    }
    if (disconnectWalletBtn) {
        disconnectWalletBtn.addEventListener('click', disconnectWallet);
    }
    if (categoryFilter) {
        categoryFilter.addEventListener('click', handleCategoryFilter);
    }
    if (sortPolls) {
        sortPolls.addEventListener('change', handleSortPolls);
    }
    if (closeModal) {
        closeModal.addEventListener('click', () => pollModal.classList.remove('active'));
    }
}

// Load Polls
async function loadPolls() {
    try {
        if (!isConnected) {
            pollsGrid.innerHTML = `
                <div class="no-polls">
                    <i class="fas fa-poll-h"></i>
                    <p>Please connect your wallet to view polls</p>
                </div>
            `;
            return;
        }

        pollsGrid.innerHTML = '<div class="loading-state"><i class="fas fa-spinner"></i></div>';
        
        // Get polls from the contract
        const response = await window.petra.view({
            function: `${CONTRACT_ADDRESS}::Voting::get_proposals`,
            type_arguments: [],
            arguments: [] // Remove wallet address parameter
        });

        polls = response;
        displayPolls(polls);
        updateStats(polls);
        
        // Update poll count in stats
        const totalPolls = polls.length;
        const activePolls = polls.filter(poll => new Date(poll.end_time) > new Date()).length;
        const totalVotes = polls.reduce((sum, poll) => sum + (poll.votes_for + poll.votes_against), 0);
        
        statsSection.innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${totalVotes}</div>
                <div class="stat-label">Total Votes</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${activePolls}</div>
                <div class="stat-label">Active Polls</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${totalPolls}</div>
                <div class="stat-label">Total Polls</div>
            </div>
        `;
    } catch (error) {
        console.error('Failed to load polls:', error);
        showError('Failed to load polls. Please try again.');
    }
}

// Display Polls
function displayPolls(polls) {
    pollsGrid.innerHTML = '';
    
    if (!polls || polls.length === 0) {
        pollsGrid.innerHTML = `
            <div class="no-polls">
                <i class="fas fa-poll-h"></i>
                <p>No active polls found. Create one to get started!</p>
            </div>
        `;
        return;
    }
    
    polls.forEach(poll => {
        const pollCard = createPollCard(poll);
        pollsGrid.appendChild(pollCard);
    });
}

// Create Poll Card
function createPollCard(poll) {
    const pollCard = document.createElement('div');
    pollCard.className = 'poll-card';
    
    // Convert category ID to category key
    const categoryKey = getCategoryKey(poll.category);
    pollCard.dataset.category = categoryKey;
    pollCard.dataset.createdAt = poll.created_at;
    pollCard.dataset.voteCount = poll.vote_count;
    
    const category = POLL_CATEGORIES[categoryKey];
    const hasVoted = poll.voters.includes(walletAddress);
    const timeRemaining = getTimeRemaining(poll.end_time);
    const totalVotes = poll.votes_for + poll.votes_against;
    
    pollCard.innerHTML = `
        <div class="poll-category">
            <i class="fas fa-${category.icon}"></i> ${category.label}
        </div>
        <div class="reward-badge">
            <i class="fas fa-gift"></i> ${poll.reward_amount} APT
        </div>
        <div class="poll-header">
            <div class="poll-title">
                <i class="fas fa-poll-h"></i>
                <h3>${poll.title}</h3>
            </div>
            <div class="poll-meta">
                <span class="time-remaining ${timeRemaining.urgent ? 'urgent' : ''}">
                    <i class="far fa-clock"></i> ${timeRemaining.text}
                </span>
                <span><i class="fas fa-users"></i> ${poll.voters.length} voters</span>
                <span><i class="far fa-calendar"></i> ${formatDate(poll.created_at)}</span>
            </div>
        </div>
        <p class="poll-description">${poll.description}</p>
        <div class="poll-progress">
            <div class="poll-progress-bar" style="width: ${(totalVotes / 100) * 100}%"></div>
        </div>
        <div class="poll-footer">
            <span class="vote-count">
                <i class="fas fa-chart-bar"></i> ${totalVotes} votes
                (${poll.votes_for} for, ${poll.votes_against} against)
            </span>
            ${!hasVoted ? `
                <button class="btn vote-btn" data-poll-id="${poll.id}">
                    <i class="fas fa-vote-yea"></i> Vote
                </button>
            ` : '<span class="voted"><i class="fas fa-check-circle"></i> Voted</span>'}
        </div>
    `;
    
    // Add event listeners
    const voteBtn = pollCard.querySelector('.vote-btn');
    if (voteBtn) {
        voteBtn.addEventListener('click', () => vote(poll.id));
    }
    
    pollCard.addEventListener('click', (e) => {
        if (!e.target.closest('.vote-btn')) {
            showPollDetails(poll);
        }
    });
    
    return pollCard;
}

// Show Poll Details Modal
function showPollDetails(poll) {
    const modalBody = document.querySelector('.modal-body');
    const category = POLL_CATEGORIES[getCategoryKey(poll.category)];
    const timeRemaining = getTimeRemaining(poll.end_time);
    const totalVotes = poll.votes_for + poll.votes_against;
    
    modalBody.innerHTML = `
        <h2>${poll.title}</h2>
        <div class="poll-meta">
            <span class="poll-category">
                <i class="fas fa-${category.icon}"></i> ${category.label}
            </span>
            <span class="time-remaining ${timeRemaining.urgent ? 'urgent' : ''}">
                <i class="far fa-clock"></i> ${timeRemaining.text}
            </span>
            <span><i class="fas fa-users"></i> ${poll.voters.length} voters</span>
            <span><i class="far fa-calendar"></i> Created: ${formatDate(poll.created_at)}</span>
        </div>
        <div class="poll-description">${poll.description}</div>
        <div class="poll-progress">
            <div class="poll-progress-bar" style="width: ${(totalVotes / 100) * 100}%"></div>
        </div>
        <div class="poll-reward">
            <i class="fas fa-gift"></i> Reward: ${poll.reward_amount} APT
        </div>
        <div class="poll-voters">
            <h3>Voters</h3>
            <div class="voters-list">
                ${poll.voters.map(voter => `
                    <div class="voter-address">
                        <i class="fas fa-user"></i> ${formatAddress(voter)}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    pollModal.classList.add('active');
}

// Create Poll
async function handleCreatePoll(event) {
    event.preventDefault();
    
    if (!isConnected) {
        showError('Please connect your wallet first');
        return;
    }

    const formData = new FormData(event.target);
    const title = formData.get('poll-title');
    const description = formData.get('poll-description');
    const category = formData.get('poll-category');
    const endTime = formData.get('poll-end-time');
    const rewardAmount = formData.get('poll-reward');

    try {
        const button = event.target.querySelector('button[type="submit"]');
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

        // Call contract method to create poll using Petra wallet
        const payload = {
            function: `${CONTRACT_ADDRESS}::Voting::create_proposal`,
            type_arguments: [],
            arguments: [
                title,
                description,
                category,
                endTime,
                rewardAmount
            ]
        };

        // Submit transaction without waiting for approval
        await window.petra.submitTransaction(payload);
        
        showSuccess('Poll created successfully!');
        event.target.reset();
        
        // Update polls and stats immediately
        await loadPolls();
        updateStats(polls);
    } catch (error) {
        console.error('Failed to create poll:', error);
        showError('Failed to create poll. Please try again.');
    } finally {
        const button = event.target.querySelector('button[type="submit"]');
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-plus"></i> Create Poll';
    }
}

// Vote
async function vote(pollId) {
    if (!isConnected) {
        showError('Please connect your wallet first');
        return;
    }

    try {
        const button = event.currentTarget;
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Voting...';

        // Call contract method to vote
        const payload = {
            function: `${CONTRACT_ADDRESS}::Voting::vote_on_proposal`,
            type_arguments: [],
            arguments: [
                pollId,
                true // vote_in_favor parameter
            ]
        };

        const response = await window.petra.signAndSubmitTransaction(payload);
        console.log('Vote submitted:', response);

        showSuccess('Vote recorded successfully!');
        await loadPolls();
    } catch (error) {
        console.error('Failed to record vote:', error);
        showError('Failed to record vote');
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-vote-yea"></i> Vote';
    }
}

// Crypto Data Setup
async function setupCryptoData() {
    const tickerContent = document.querySelector('.ticker-content');
    if (!tickerContent) return;

    // Create ticker container if it doesn't exist
    let tickerContainer = document.querySelector('.crypto-ticker');
    if (!tickerContainer) {
        tickerContainer = document.createElement('div');
        tickerContainer.className = 'crypto-ticker';
        tickerContainer.innerHTML = '<div class="ticker-content"></div>';
        document.body.insertBefore(tickerContainer, document.body.firstChild);
    }

    // Initialize ticker items
    tickerContent.innerHTML = CRYPTO_SYMBOLS.map(symbol => `
        <div class="ticker-item" data-symbol="${symbol}">
            <i class="fab fa-${symbol.toLowerCase()}"></i>
            <span class="price">Loading...</span>
        </div>
    `).join('');

    // Update prices immediately and set interval
    await updateCryptoPrices();
    setInterval(updateCryptoPrices, UPDATE_INTERVAL);
}

// Update Crypto Prices
async function updateCryptoPrices() {
    try {
        const response = await fetch(
            `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${CRYPTO_SYMBOLS.join(',')}`,
            {
                headers: {
                    'X-CMC_PRO_API_KEY': COINMARKETCAP_API_KEY
                }
            }
        );
        const data = await response.json();

        CRYPTO_SYMBOLS.forEach(symbol => {
            const tickerItem = document.querySelector(`.ticker-item[data-symbol="${symbol}"]`);
            if (!tickerItem) return;

            const price = data.data[symbol]?.quote?.USD?.price;
            const change = data.data[symbol]?.quote?.USD?.percent_change_24h;
            
            if (price !== undefined) {
                tickerItem.querySelector('.price').textContent = 
                    `$${price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                
                tickerItem.classList.toggle('positive', change > 0);
                tickerItem.classList.toggle('negative', change < 0);
            }
        });
    } catch (error) {
        console.error('Failed to update crypto prices:', error);
    }
}

// Setup Floating Icons
function setupFloatingIcons() {
    const floatingCrypto = document.querySelector('.floating-crypto');
    const icons = CRYPTO_SYMBOLS.map(symbol => `
        <i class="fab fa-${symbol.toLowerCase()} crypto-icon" style="
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            animation-delay: ${Math.random() * 20}s;
        "></i>
    `).join('');
    floatingCrypto.innerHTML = icons;
}

// Update Stats
function updateStats(polls) {
    const totalVotes = polls.reduce((sum, poll) => sum + parseInt(poll.vote_count), 0);
    const activePolls = polls.filter(poll => new Date(poll.end_time) > new Date()).length;
    const totalPolls = polls.length;

    statsSection.innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${totalVotes}</div>
            <div class="stat-label">Total Votes</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${activePolls}</div>
            <div class="stat-label">Active Polls</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${totalPolls}</div>
            <div class="stat-label">Total Polls</div>
        </div>
    `;
}

// Utility Functions
function formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
}

function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
    document.body.appendChild(successDiv);
    setTimeout(() => successDiv.remove(), 5000);
}

// Category Filter Handler
function handleCategoryFilter(event) {
    if (!event.target.classList.contains('category-btn')) return;
    
    const category = event.target.dataset.category;
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.category === category) {
            btn.classList.add('active');
        }
    });

    filterPolls(category);
}

// Sort Polls Handler
function handleSortPolls(event) {
    const sortBy = event.target.value;
    sortPollsList(sortBy);
}

// Filter Polls
function filterPolls(category) {
    const pollsGrid = document.getElementById('pollsGrid');
    const pollCards = pollsGrid.querySelectorAll('.poll-card');
    
    pollCards.forEach(card => {
        if (category === 'all') {
            card.style.display = 'block';
        } else {
            const cardCategory = card.dataset.category;
            if (cardCategory === category) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        }
    });
}

// Sort Polls List
function sortPollsList(sortBy) {
    const pollsGrid = document.getElementById('pollsGrid');
    const pollCards = Array.from(pollsGrid.querySelectorAll('.poll-card'));
    
    pollCards.sort((a, b) => {
        switch (sortBy) {
            case 'newest':
                return new Date(b.dataset.createdAt) - new Date(a.dataset.createdAt);
            case 'oldest':
                return new Date(a.dataset.createdAt) - new Date(b.dataset.createdAt);
            case 'votes':
                return parseInt(b.dataset.voteCount) - parseInt(a.dataset.voteCount);
            default:
                return 0;
        }
    });
    
    pollCards.forEach(card => pollsGrid.appendChild(card));
}

function getCategoryKey(categoryId) {
    const categoryIdNum = parseInt(categoryId);
    for (const [key, value] of Object.entries(POLL_CATEGORIES)) {
        if (value.id === categoryIdNum) {
            return key;
        }
    }
    return 'general';
}

function getTimeRemaining(endTime) {
    const now = Date.now();
    const end = new Date(endTime).getTime();
    const diff = end - now;
    
    if (diff <= 0) {
        return { text: 'Ended', urgent: false };
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return {
        text: `${hours}h ${minutes}m remaining`,
        urgent: hours < 24
    };
}

function formatAddress(address) {
    if (!address) return 'Not Connected';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Reset poll count
function resetPollCount() {
    const statsSection = document.getElementById('statsSection');
    statsSection.innerHTML = `
        <div class="stat-card">
            <div class="stat-value">0</div>
            <div class="stat-label">Total Polls</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">0</div>
            <div class="stat-label">Active Polls</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">0</div>
            <div class="stat-label">Total Votes</div>
        </div>
    `;
}

// Initialize the application
init(); 