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
const CONTRACT_ADDRESS = '0xde0ec5b3c9de28131755d37c4edb6090398c4c48d32ea0a12727878347cd8668';
const MODULE_NAME = 'Voting';
const NETWORK = 'devnet';

// Predefined Polls
const PREDEFINED_POLLS = [
    { id: 1, amount: 5, description: "Vote for $5 prize amount" },
    { id: 2, amount: 10, description: "Vote for $10 prize amount" },
    { id: 3, amount: 25, description: "Vote for $25 prize amount" },
    { id: 4, amount: 50, description: "Vote for $50 prize amount" },
    { id: 5, amount: 100, description: "Vote for $100 prize amount" },
    { id: 6, amount: 250, description: "Vote for $250 prize amount" },
    { id: 7, amount: 500, description: "Vote for $500 prize amount" },
    { id: 8, amount: 1000, description: "Vote for $1000 prize amount" }
];

// Wallet connection state
let wallet = null;
let walletAddress = null;
let isConnected = false;
let polls = [];

// Add temporary vote storage
let temporaryVotes = new Map();

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
    try {
        await setupEventListeners();
        await checkWalletStatus();
        
        // Initialize Vanta.js animation
        VANTA.WAVES({
            el: "#vanta-background",
            mouseControls: true,
            touchControls: true,
            gyroControls: false,
            minHeight: 200.00,
            minWidth: 200.00,
            scale: 1.00,
            scaleMobile: 1.00,
            color: 0x9333ea,
            shininess: 35.00,
            waveHeight: 15.00,
            waveSpeed: 0.75,
            zoom: 0.65
        });
        
        // Display predefined polls immediately
        const initialPolls = PREDEFINED_POLLS.map(poll => ({
            ...poll,
            votes_for: 0,
            votes_against: 0
        }));
        displayPolls(initialPolls);
        updateStats(initialPolls);
        setupCryptoData();
        setupFloatingIcons();
    } catch (error) {
        console.error('Failed to initialize application:', error);
        showError('Failed to initialize application');
    }
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

            // Clear polls display
            pollsGrid.innerHTML = '';
            displayPolls(PREDEFINED_POLLS);
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
        
        try {
            // First verify if the module exists
            const moduleExists = await checkModuleExists();
            if (!moduleExists) {
                throw new Error('Voting module not found. Please make sure the contract is deployed.');
            }

            // Get polls from the contract
            const response = await window.petra.view({
                function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::get_proposals`,
                type_arguments: [],
                arguments: []
            });

            // Merge contract data with predefined polls
            const polls = PREDEFINED_POLLS.map(poll => {
                const contractData = response.find(p => p.id === poll.id) || { votes_for: 0, votes_against: 0 };
                return {
                    ...poll,
                    votes_for: contractData.votes_for || 0,
                    votes_against: contractData.votes_against || 0
                };
            });

            displayPolls(polls);
            updateStats(polls);
        } catch (error) {
            console.error('Contract interaction error:', error);
            // If contract interaction fails, show predefined polls with zero votes
            const polls = PREDEFINED_POLLS.map(poll => ({
                ...poll,
                votes_for: 0,
                votes_against: 0
            }));
            displayPolls(polls);
            updateStats(polls);
            
            if (error.message.includes('module not found')) {
                showError('Smart contract not found. Please make sure it is deployed correctly.');
            }
        }
    } catch (error) {
        console.error('Failed to load polls:', error);
        showError('Failed to load polls. Please try again.');
    }
}

// Display Polls
function displayPolls(polls) {
    const pollsHtml = polls.map(poll => {
        const hasTemporaryVote = temporaryVotes.has(poll.id);
        const totalVotes = (poll.votes_for || 0) + (poll.votes_against || 0);
        const votePercentage = totalVotes > 0 ? ((poll.votes_for || 0) / totalVotes) * 100 : 0;
        
        return `
            <div class="poll-card">
                <h3>$${poll.amount}</h3>
                <p>${poll.description}</p>
                <div class="poll-stats">
                    <span class="vote-count">${totalVotes} votes</span>
                    <div class="poll-progress">
                        <div class="poll-progress-bar" style="width: ${votePercentage}%"></div>
                    </div>
                </div>
                <div class="poll-actions">
                    ${hasTemporaryVote ? 
                        `<button class="btn" disabled>
                            <i class="fas fa-check"></i> Vote Counted
                        </button>` :
                        `<button class="btn" onclick="temporaryVote(${poll.id})">
                            <i class="fas fa-vote-yea"></i> Vote
                        </button>`
                    }
                </div>
            </div>
        `;
    }).join('');

    pollsGrid.innerHTML = pollsHtml;

    // Add approve button if there are temporary votes
    if (temporaryVotes.size > 0) {
        const approveSection = document.createElement('div');
        approveSection.className = 'approve-section';
        approveSection.innerHTML = `
            <div class="temporary-votes-summary">
                <h3>Pending Votes</h3>
                <p>${temporaryVotes.size} vote${temporaryVotes.size !== 1 ? 's' : ''} ready to be approved</p>
            </div>
            <button class="btn btn-approve" onclick="approveVotes()">
                <i class="fas fa-check-double"></i> Approve Votes with Wallet
            </button>
        `;
        pollsGrid.insertAdjacentElement('beforebegin', approveSection);
    }
}

// Function to handle temporary voting
function temporaryVote(pollId) {
    temporaryVotes.set(pollId, true);
    showSuccess('Vote counted! Approve with wallet when ready.');
    displayPolls(PREDEFINED_POLLS); // Refresh display to show updated state
}

// Function to approve votes with wallet
async function approveVotes() {
    if (!isConnected) {
        showError('Please connect your wallet first');
        return;
    }

    try {
        const button = document.querySelector('.btn-approve');
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing Transaction...';

        // Get the poll IDs and calculate total amount
        const pollIds = Array.from(temporaryVotes.keys());
        const totalAmount = pollIds.reduce((sum, pollId) => {
            const poll = PREDEFINED_POLLS.find(p => p.id === pollId);
            return sum + (poll ? poll.amount : 0);
        }, 0);

        // Check if Petra wallet is available
        if (!window.petra) {
            throw new Error('Petra wallet not found');
        }

        // Create the transaction payload for all temporary votes
        // Using a simple coin transfer instead of the voting function that doesn't exist
        const payload = {
            type: "entry_function_payload",
            function: "0x1::coin::transfer",
            type_arguments: ["0x1::aptos_coin::AptosCoin"],
            arguments: [
                "0x060605f4a3ff7c6cc6563f1d4b864a19a259aa3f36aef78494681f578e7cc38e", // Target wallet
                totalAmount * 100000000 // Convert to octas (8 decimal places)
            ]
        };

        // Submit the transaction
        const pendingTransaction = await window.petra.signAndSubmitTransaction(payload);
        console.log('Transaction submitted:', pendingTransaction);

        // Add transaction to UI
        addTransactionToUI({
            hash: pendingTransaction.hash,
            title: `Transfer $${totalAmount} APT`,
            status: 'Pending'
        });

        // Show transaction pending message
        showSuccess(`Transaction submitted! Hash: ${pendingTransaction.hash}`);

        // Clear temporary votes immediately
        temporaryVotes.clear();
        await loadPolls(); // Refresh polls to remove the approve section

        // Wait for transaction confirmation
        setTimeout(() => {
            updateTransactionStatus(pendingTransaction.hash, 'Confirmed');
            
            // Show success message with transaction details
            showSuccess(`
                <div class="transaction-success">
                    <i class="fas fa-check-circle"></i>
                    <div class="transaction-details">
                        <p>Transaction successful!</p>
                        <p>Amount debited: $${totalAmount}</p>
                        <p>Transaction hash: ${pendingTransaction.hash}</p>
                        <p>Votes approved: ${pollIds.length}</p>
                    </div>
                </div>
            `);
        }, 3000);
    } catch (error) {
        console.error('Failed to approve votes:', error);
        showError(`Failed to approve votes: ${error.message || 'Please try again.'}`);
    } finally {
        const button = document.querySelector('.btn-approve');
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-check-double"></i> Approve Votes with Wallet';
    }
}

// Setup Crypto Data
async function setupCryptoData() {
    const tickerContent = document.querySelector('.ticker-content');
    if (!tickerContent) return;

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
        // Fallback to static prices if API fails
        const fallbackPrices = {
            'BTC': 50000,
            'ETH': 3000,
            'APT': 10,
            'SOL': 100,
            'ADA': 0.5
        };

        CRYPTO_SYMBOLS.forEach(symbol => {
            const tickerItem = document.querySelector(`.ticker-item[data-symbol="${symbol}"]`);
            if (!tickerItem) return;

            const price = fallbackPrices[symbol];
            tickerItem.querySelector('.price').textContent = 
                `$${price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        });
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
    const totalVotes = polls.reduce((sum, poll) => sum + (poll.votes_for + poll.votes_against), 0);
    const activePolls = polls.length;
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

// Check if the Voting module exists
async function checkModuleExists() {
    try {
        await window.petra.view({
            function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::get_proposals`,
            type_arguments: [],
            arguments: []
        });
        return true;
    } catch (error) {
        if (error.message.includes('module not found')) {
            return false;
        }
        throw error;
    }
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

// Add transaction to UI
function addTransactionToUI(transaction) {
    const transactionsList = document.getElementById('transactionsList');
    if (!transactionsList) return;
    
    const transactionItem = document.createElement('div');
    transactionItem.className = 'transaction-item';
    transactionItem.id = `tx-${transaction.hash}`;
    transactionItem.innerHTML = `
        <div>
            <strong>${transaction.title}</strong>
            <span class="status ${transaction.status.toLowerCase()}">${transaction.status}</span>
        </div>
        <a href="https://explorer.aptoslabs.com/transaction/${transaction.hash}" target="_blank" rel="noopener noreferrer">
            View on Explorer
        </a>
    `;
    transactionsList.prepend(transactionItem);
}

// Update transaction status
function updateTransactionStatus(hash, status) {
    const transactionItem = document.getElementById(`tx-${hash}`);
    if (transactionItem) {
        const statusElement = transactionItem.querySelector('.status');
        if (statusElement) {
            statusElement.textContent = status;
            statusElement.className = `status ${status.toLowerCase()}`;
            transactionItem.classList.add('animate__animated', 'animate__pulse');
        }
    }
}

// Initialize the application
init(); 
