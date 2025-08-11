import React, { useState, useEffect } from 'react';
import '../styling/inGameStore.css';

// Enum for store pages
const PAGE = {
	MAIN: 'main',
	COINS: 'coins',
	STORE: 'store',
};

// Utility functions for RPC calls
const getAssets = async (userSession) => {
	try {
		if (!userSession?.client || !userSession?.session) {
			throw new Error('User session not available');
		}
		
		const response = await userSession.client.rpc(userSession.session, "get_assets", "");
		console.log('Raw getAssets RPC response:', response);
		
		// Check if payload is already an object or needs parsing
		if (typeof response.payload === 'string') {
			return JSON.parse(response.payload);
		} else {
			return response.payload;
		}
	} catch (error) {
		console.error('Failed to get assets:', error);
		throw error;
	}
};

const addCoins = async (userSession, coinsToAdd) => {
	try {
		if (!userSession?.client || !userSession?.session) {
			throw new Error('User session not available');
		}
		
		const payload = { coinsToAdd: coinsToAdd };
		console.log('Calling add_coins RPC with payload:', payload);
		
		const response = await userSession.client.rpc(userSession.session, "add_coins", payload);
		console.log('Raw addCoins RPC response:', response);
		
		// Check if payload is already an object or needs parsing
		if (typeof response.payload === 'string') {
			return JSON.parse(response.payload);
		} else {
			return response.payload;
		}
	} catch (error) {
		console.error('Failed to add coins:', error);
		throw error;
	}
};

// Main Store Navigation Component
export default function StoreNavigation({ onBackToMenu, initialPage, userSession, onCoinsUpdate }) {
	// initialPage: 'coins' | 'store'
	if (initialPage === 'coins') {
		return <PurchaseCoinsPage onBack={onBackToMenu} userSession={userSession} onCoinsUpdate={onCoinsUpdate} />;
	}
	if (initialPage === 'store') {
		return <InGameStorePage onBack={onBackToMenu} userSession={userSession} onCoinsUpdate={onCoinsUpdate} />;
	}
	return null;
}

// Purchase Coins Page
function PurchaseCoinsPage({ onBack, userSession, onCoinsUpdate }) {
	const [currentCoins, setCurrentCoins] = useState(0);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState(null);

	// Load current coin balance on component mount
	useEffect(() => {
		loadCurrentCoins();
	}, []);

	const loadCurrentCoins = async () => {
		try {
			const assets = await getAssets(userSession);
			setCurrentCoins(assets.coins || 0);
		} catch (error) {
			console.error('Failed to load current coins:', error);
			setError('Failed to load coin balance');
		}
	};

	const handleCoinPurchase = async (coinsToAdd) => {
		setIsLoading(true);
		setError(null);
		
		try {
			// Call the add_coins RPC
			await addCoins(userSession, coinsToAdd);
			
			// Refresh coin balance
			await loadCurrentCoins();
			
			// Notify parent component about coin update
			if (onCoinsUpdate) {
				const assets = await getAssets(userSession);
				onCoinsUpdate(assets.coins || 0);
			}
			
			console.log(`Successfully added ${coinsToAdd} coins`);
		} catch (error) {
			console.error('Failed to purchase coins:', error);
			setError('Failed to purchase coins. Please try again.');
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="purchase-coins-page">
			<button className="back-arrow" onClick={onBack} title="Back to Store Menu">&larr;</button>
			<h2 className="purchase-title">Buy Coins</h2>
			
			{/* Current Balance Display */}
			<div className="current-balance">
				<p>Current Balance: <span className="balance-amount">{currentCoins.toLocaleString()} 🪙</span></p>
			</div>
			
			{/* Error Display */}
			{error && <div className="error-message">{error}</div>}
			
			<div className="coin-options">
				<CoinOption 
					coins={1000} 
					price={0.99} 
					onPurchase={() => handleCoinPurchase(1000)}
					disabled={isLoading}
				/>
				<CoinOption 
					coins={5000} 
					price={4.99} 
					onPurchase={() => handleCoinPurchase(5000)}
					disabled={isLoading}
				/>
				<CoinOption 
					coins={11000} 
					price={9.99} 
					onPurchase={() => handleCoinPurchase(11000)}
					disabled={isLoading}
				/>
			</div>
			
			{isLoading && <div className="loading-indicator">Processing purchase...</div>}
		</div>
	);
}

function CoinOption({ coins, price, onPurchase, disabled }) {
	return (
		<div className="coin-option">
			<div className="coin-amount">{coins.toLocaleString()} <span role="img" aria-label="coin">🪙</span></div>
			<div className="coin-price">${price.toFixed(2)}</div>
			<button 
				className="buy-btn" 
				onClick={onPurchase}
				disabled={disabled}
			>
				{disabled ? 'Processing...' : 'Buy'}
			</button>
		</div>
	);
}

// In-Game Store Page
function InGameStorePage({ onBack, userSession, onCoinsUpdate }) {
	const [currentCoins, setCurrentCoins] = useState(0);
	const [isLoading, setIsLoading] = useState(false);

	// Load current coin balance on component mount
	useEffect(() => {
		loadCurrentCoins();
	}, []);

	const loadCurrentCoins = async () => {
		try {
			const assets = await getAssets(userSession);
			setCurrentCoins(assets.coins || 0);
		} catch (error) {
			console.error('Failed to load current coins:', error);
		}
	};

	return (
		<div className="in-game-store-page">
			<button className="back-arrow" onClick={onBack} title="Back to Store Menu">&larr;</button>
			<h2 className="store-title">In-Game Store</h2>
			
			{/* Current Balance Display */}
			<div className="current-balance">
				<p>Current Balance: <span className="balance-amount">{currentCoins.toLocaleString()} 🪙</span></p>
			</div>
			
			<div className="store-items-list">
				{/* Placeholder items */}
				<StoreItem name="Cool Hat" price={500} />
				<StoreItem name="Fancy Skin" price={2000} />
				<StoreItem name="Epic Mount" price={7500} />
			</div>
		</div>
	);
}

function StoreItem({ name, price }) {
	return (
		<div className="store-item">
			<div className="item-name">{name}</div>
			<div className="item-price">{price.toLocaleString()} <span role="img" aria-label="coin">🪙</span></div>
			<button className="buy-btn" disabled>Buy</button>
		</div>
	);
}
