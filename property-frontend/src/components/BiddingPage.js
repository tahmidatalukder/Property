import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

function BiddingPage() {
    const { propertyId } = useParams();
    const [property, setProperty] = useState(null);
    const [bidPrice, setBidPrice] = useState('');
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState(null);
    const [showPayment, setShowPayment] = useState(false);
    const navigate = useNavigate();
    const API_URL = 'http://localhost:5000';

    const fetchProperty = async () => {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${API_URL}/property/${propertyId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            setProperty(data);

            const decodedToken = jwt_decode(token);
            setUserId(decodedToken.id);

            // Check if current user is the winning bidder
            if (data.winningBidder && data.winningBidder === decodedToken.id) {
                setShowPayment(true);
            }

        } catch (error) {
            console.error('Error fetching property:', error);
        } finally {
            setLoading(false);
        }
    };
    
    useEffect(() => {
        fetchProperty();
    }, [propertyId]);

    const handleBidSubmit = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('accessToken');
            await fetch(`${API_URL}/api/property/${propertyId}/bid`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ price: bidPrice })
            });
            setBidPrice('');
            fetchProperty(); // Refresh bids
        } catch (error) {
            console.error('Error placing bid:', error);
        }
    };

    const handleAcceptBid = async (bidUserId) => {
        if (window.confirm("Are you sure you want to accept this bid? This cannot be undone.")) {
            try {
                const token = localStorage.getItem('accessToken');
                await fetch(`${API_URL}/api/property/${propertyId}/accept-bid`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ bidUserId })
                });
                alert('Bid accepted! The winner will be notified to make the payment.');
                fetchProperty(); // Refresh property status
            } catch (error) {
                console.error('Error accepting bid:', error);
            }
        }
    };
    
    const handlePayment = async (accountNumber) => {
        if (!accountNumber) { alert('Please provide account number.'); return; }
        try {
             const token = localStorage.getItem('accessToken');
             const response = await fetch(`${API_URL}/api/purchase/${propertyId}`, {
                 method: 'POST',
                 headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                 body: JSON.stringify({ accountNumber })
             });
             if (response.ok) {
                 alert('Payment successful!');
                 navigate('/profile');
             } else {
                 alert('Payment failed.');
             }
        } catch(err) {
            console.error(err);
        }
    }

    if (loading) return <p>Loading bidding details...</p>;
    if (!property) return <p>Property not found.</p>;

    const isOwner = property.ownerId === userId;

    return (
        <div>
            <h2>Bidding for {property.type} at {property.location}</h2>
            
            {showPayment ? (
                 <div>
                    <h3>Congratulations! Your bid was accepted.</h3>
                    <p>Please complete the payment.</p>
                    <input type="text" id="accountNum" placeholder="Account Number" />
                    <button className="btn btn-primary" onClick={() => handlePayment(document.getElementById('accountNum').value)}>Pay Now</button>
                 </div>
            ) : (
                <>
                    <div className="bidding-list">
                        <h3>Bidding Price List</h3>
                        {property.bids && property.bids.length > 0 ? (
                            <ul>
                                {property.bids.sort((a, b) => b.price - a.price).map((bid, index) => (
                                    <li key={index}>
                                        {bid.userName}: <strong>{bid.price.toFixed(2)} BDT</strong>
                                        {isOwner && !property.winningBidder && (
                                            <button className="btn btn-sm" onClick={() => handleAcceptBid(bid.userId)}>Accept</button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p>No bids placed yet.</p>
                        )}
                    </div>
                    
                    {!isOwner && !property.winningBidder && (
                        <form onSubmit={handleBidSubmit} className="bid-form">
                            <h3>Place Your Bid</h3>
                            <input
                                type="number"
                                placeholder="Your Price"
                                value={bidPrice}
                                onChange={(e) => setBidPrice(e.target.value)}
                                required
                            />
                            <button type="submit" className="btn btn-primary">OK</button>
                        </form>
                    )}

                    {property.winningBidder && <p style={{color: 'green', fontWeight: 'bold'}}>A winning bid has been selected.</p>}
                </>
            )}
        </div>
    );
}

export default BiddingPage;
