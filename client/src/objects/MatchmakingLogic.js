// src/logic/MatchmakingLogic.js
import { useState, useEffect } from 'react';

/**
 * Custom hook that handles all matchmaking logic
 * This manages the connection to the matchmaking server and handles finding other players
 */
export const useMatchmaking = (userSession, onMatchFound, onMatchmakingError) => {
  // State to track if we're currently looking for a match
  const [isSearching, setIsSearching] = useState(false);
  
  // The "ticket" is like a receipt that proves we're in the matchmaking queue
  const [matchTicket, setMatchTicket] = useState(null);
  
  // List of players who will be in our match once found
  const [playersInMatch, setPlayersInMatch] = useState([]);
  
  // When we started searching (used to calculate how long we've been waiting)
  const [searchStartTime, setSearchStartTime] = useState(null);
  
  // How many seconds we've been searching
  const [elapsedTime, setElapsedTime] = useState(0);

  // Set up listeners for matchmaking events from the server
  useEffect(() => {
    // Make sure we have a valid connection before setting up listeners
    if (!userSession?.socket) return;

    const socket = userSession.socket;

    // Listen for when the server finds us a match
    socket.onmatchmakermatched = (matched) => {
      console.log("Match found:", matched);
      
      // Stop showing "searching" since we found a match
      setIsSearching(false);
      
      // Save the list of players who will be in our match
      setPlayersInMatch(matched.users || []);
      
      // Package up all the match information to send back to the game
      const matchData = {
        match_id: matched.match_id,    // Unique ID for this match
        token: matched.token,          // Special token to join the match
        users: matched.users || [],    // List of all players in the match
        self: matched.self,            // Information about ourselves
        presences: matched.presences || [] // Real-time presence info
      };
      
      console.log("Processed match data:", matchData);
      
      // Tell the game that we found a match
      onMatchFound(matchData);
    };

    // Listen for when we get our "ticket" (proof we're in the queue)
    socket.onmatchmakerticker = (ticket) => {
      console.log("Matchmaking ticket received:", ticket);
      setMatchTicket(ticket);
    };

    // Listen for any errors that happen during matchmaking
    socket.onmatchmakererror = (error) => {
      console.error("Matchmaker error:", error);
      setIsSearching(false); // Stop showing "searching"
      onMatchmakingError?.(error.message || "Matchmaking failed");
    };

    // Clean up listeners when component unmounts or userSession changes
    return () => {
      socket.onmatchmakermatched = null;
      socket.onmatchmakerticker = null;
      socket.onmatchmakererror = null;
    };
  }, [userSession, onMatchFound, onMatchmakingError]);

  // Update the timer every second while we're searching
  useEffect(() => {
    let interval;
    if (isSearching && searchStartTime) {
      // Update elapsed time every second
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - searchStartTime) / 1000));
      }, 1000);
    } else {
      // Reset timer when not searching
      setElapsedTime(0);
    }

    // Clean up the interval when we stop searching
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSearching, searchStartTime]);

  /**
   * Helper function to display the ticket in a user-friendly way
   * Tickets can be strings or objects, so we need to handle both cases
   */
  const getTicketDisplay = (ticket) => {
    if (!ticket) return '';
    
    // If ticket is already a string, just shorten it if needed
    if (typeof ticket === 'string') {
      return ticket.length > 8 ? ticket.substring(0, 8) + '...' : ticket;
    }
    
    // If ticket is an object, try to find the actual ticket string inside it
    if (typeof ticket === 'object') {
      if (ticket.ticket && typeof ticket.ticket === 'string') {
        return ticket.ticket.length > 8 ? ticket.ticket.substring(0, 8) + '...' : ticket.ticket;
      }
      
      // If we can't find a ticket property, convert the whole object to string
      const ticketStr = JSON.stringify(ticket);
      return ticketStr.length > 8 ? ticketStr.substring(0, 8) + '...' : ticketStr;
    }
    
    // Fallback: just convert whatever we have to a string
    const ticketStr = String(ticket);
    return ticketStr.length > 8 ? ticketStr.substring(0, 8) + '...' : ticketStr;
  };

  /**
   * Start looking for a match
   * This tells the server we want to play with other people
   */
  const startMatchmaking = async () => {
    // Make sure we're connected to the server
    if (!userSession?.socket) {
      onMatchmakingError?.("Not connected to server");
      return;
    }

    // Update our state to show we're searching
    setIsSearching(true);
    setSearchStartTime(Date.now());
    setElapsedTime(0);
    
    try {
      // Set up matchmaking parameters
      const matchmakingQuery = "+properties.region:*"; // Match with anyone in any region
      const minPlayers = 2; // Need at least 2 players for a match
      const maxPlayers = 4; // But no more than 4 players total
      
      // Properties to help match us with compatible players
      const stringProperties = {
        "region": "global",        // Everyone uses the same region for simplicity
        "game_mode": "dino_battle" // Make sure we're all playing the same game mode
      };
      const numericProperties = {
        "skill": 1000,  // Use same skill level for all players (simplified)
        "version": 1    // Make sure everyone is using the same game version
      };

      console.log("Starting matchmaking with parameters:", {
        query: matchmakingQuery,
        minPlayers,
        maxPlayers,
        stringProperties,
        numericProperties
      });

      // Actually start the matchmaking process
      const ticket = await userSession.socket.addMatchmaker(
        matchmakingQuery,
        minPlayers,
        maxPlayers,
        stringProperties,
        numericProperties
      );
      
      console.log("Matchmaking started with ticket:", ticket);
      setMatchTicket(ticket);
    } catch (error) {
      // If something goes wrong, stop searching and show the error
      console.error("Matchmaking error:", error);
      setIsSearching(false);
      setSearchStartTime(null);
      onMatchmakingError?.(error.message || "Failed to start matchmaking");
    }
  };

  /**
   * Stop looking for a match
   * This removes us from the matchmaking queue
   */
  const cancelMatchmaking = async () => {
    // Make sure we have a connection and a ticket to cancel
    if (!userSession?.socket || !matchTicket) return;

    try {
      // Tell the server to remove us from the matchmaking queue
      await userSession.socket.removeMatchmaker(matchTicket);
      
      // Reset all our searching state
      setIsSearching(false);
      setSearchStartTime(null);
      setMatchTicket(null);
      setElapsedTime(0);
      
      console.log("Matchmaking cancelled");
    } catch (error) {
      console.error("Error cancelling matchmaking:", error);
    }
  };

  // Return all the state and functions that the UI component needs
  return {
    // Current state
    isSearching,
    matchTicket,
    playersInMatch,
    elapsedTime,
    
    // Helper functions
    getTicketDisplay,
    
    // Actions
    startMatchmaking,
    cancelMatchmaking
  };
};