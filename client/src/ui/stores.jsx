import React, { useState } from 'react';
import '../styling/inGameStore.css';

// Enum for store pages
const PAGE = {
	MAIN: 'main',
	COINS: 'coins',
	STORE: 'store',
};

// Main Store Navigation Component
export default function StoreNavigation({ onBackToMenu, initialPage }) {
	// initialPage: 'coins' | 'store'
	if (initialPage === 'coins') {
		return <PurchaseCoinsPage onBack={onBackToMenu} />;
	}
	if (initialPage === 'store') {
		return <InGameStorePage onBack={onBackToMenu} />;
	}
	return null;
}

// Purchase Coins Page
function PurchaseCoinsPage({ onBack }) {
	return (
		<div className="purchase-coins-page">
			<button className="back-arrow" onClick={onBack} title="Back to Store Menu">&larr;</button>
			<h2 className="purchase-title">Buy Coins</h2>
			<div className="coin-options">
				<CoinOption coins={1000} price={0.99} />
				<CoinOption coins={5000} price={4.99} />
				<CoinOption coins={11000} price={9.99} />
			</div>
		</div>
	);
}

function CoinOption({ coins, price }) {
	return (
		<div className="coin-option">
			<div className="coin-amount">{coins.toLocaleString()} <span role="img" aria-label="coin">🪙</span></div>
			<div className="coin-price">${price.toFixed(2)}</div>
			<button className="buy-btn" disabled>Buy</button>
		</div>
	);
}

// In-Game Store Page
function InGameStorePage({ onBack }) {
	return (
		<div className="in-game-store-page">
			<button className="back-arrow" onClick={onBack} title="Back to Store Menu">&larr;</button>
			<h2 className="store-title">In-Game Store</h2>
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
