"""
WebSocket Connection Manager for handling multiple client connections.
"""

import asyncio
import logging
from typing import Dict, Set, Optional, Any
from fastapi import WebSocket
from dataclasses import dataclass
from uuid import UUID
import json

logger = logging.getLogger(__name__)


@dataclass
class ConnectedClient:
    """Represents a connected WebSocket client."""
    websocket: WebSocket
    user_id: Optional[UUID] = None
    username: Optional[str] = None
    rooms: Set[str] = None
    
    def __post_init__(self):
        if self.rooms is None:
            self.rooms = set()


class ConnectionManager:
    """
    Manages WebSocket connections for real-time game communication.
    
    Features:
    - Multiple connection tracking
    - Room-based messaging (for different games)
    - User authentication tracking
    - Broadcast and targeted messaging
    """
    
    def __init__(self):
        self._connections: Dict[str, ConnectedClient] = {}
        self._rooms: Dict[str, Set[str]] = {}
        self._user_connections: Dict[str, Set[str]] = {}
        self._lock = asyncio.Lock()
    
    async def connect(
        self,
        websocket: WebSocket,
        connection_id: str,
        user_id: Optional[UUID] = None,
        username: Optional[str] = None
    ) -> ConnectedClient:
        """Accept a new WebSocket connection."""
        await websocket.accept()
        
        client = ConnectedClient(
            websocket=websocket,
            user_id=user_id,
            username=username
        )
        
        async with self._lock:
            self._connections[connection_id] = client
            
            if user_id:
                user_key = str(user_id)
                if user_key not in self._user_connections:
                    self._user_connections[user_key] = set()
                self._user_connections[user_key].add(connection_id)
        
        logger.info(f"Client connected: {connection_id} (user: {username})")
        return client
    
    async def disconnect(self, connection_id: str):
        """Remove a WebSocket connection."""
        async with self._lock:
            if connection_id not in self._connections:
                return
            
            client = self._connections[connection_id]
            
            # Remove from all rooms
            for room in list(client.rooms):
                if room in self._rooms:
                    self._rooms[room].discard(connection_id)
                    if not self._rooms[room]:
                        del self._rooms[room]
            
            # Remove from user connections
            if client.user_id:
                user_key = str(client.user_id)
                if user_key in self._user_connections:
                    self._user_connections[user_key].discard(connection_id)
                    if not self._user_connections[user_key]:
                        del self._user_connections[user_key]
            
            del self._connections[connection_id]
        
        logger.info(f"Client disconnected: {connection_id}")
    
    async def join_room(self, connection_id: str, room: str):
        """Add a connection to a room."""
        async with self._lock:
            if connection_id not in self._connections:
                return
            
            if room not in self._rooms:
                self._rooms[room] = set()
            
            self._rooms[room].add(connection_id)
            self._connections[connection_id].rooms.add(room)
        
        logger.debug(f"Client {connection_id} joined room: {room}")
    
    async def leave_room(self, connection_id: str, room: str):
        """Remove a connection from a room."""
        async with self._lock:
            if connection_id in self._connections:
                self._connections[connection_id].rooms.discard(room)
            
            if room in self._rooms:
                self._rooms[room].discard(connection_id)
                if not self._rooms[room]:
                    del self._rooms[room]
    
    async def send_personal(self, connection_id: str, message: dict):
        """Send a message to a specific connection."""
        if connection_id not in self._connections:
            return
        
        try:
            await self._connections[connection_id].websocket.send_json(message)
        except Exception as e:
            logger.error(f"Failed to send to {connection_id}: {e}")
            await self.disconnect(connection_id)
    
    async def send_to_user(self, user_id: UUID, message: dict):
        """Send a message to all connections of a user."""
        user_key = str(user_id)
        if user_key not in self._user_connections:
            return
        
        for connection_id in list(self._user_connections.get(user_key, [])):
            await self.send_personal(connection_id, message)
    
    async def broadcast(self, message: dict, exclude: Optional[Set[str]] = None):
        """Broadcast a message to all connections."""
        exclude = exclude or set()
        
        for connection_id in list(self._connections.keys()):
            if connection_id not in exclude:
                await self.send_personal(connection_id, message)
    
    async def broadcast_to_room(
        self,
        room: str,
        message: dict,
        exclude: Optional[Set[str]] = None
    ):
        """Broadcast a message to all connections in a room."""
        exclude = exclude or set()
        
        if room not in self._rooms:
            return
        
        for connection_id in list(self._rooms.get(room, [])):
            if connection_id not in exclude:
                await self.send_personal(connection_id, message)
    
    @property
    def connection_count(self) -> int:
        """Get total number of connections."""
        return len(self._connections)
    
    def room_count(self, room: str) -> int:
        """Get number of connections in a room."""
        return len(self._rooms.get(room, set()))
    
    def get_room_users(self, room: str) -> list:
        """Get list of usernames in a room."""
        if room not in self._rooms:
            return []
        
        users = []
        for conn_id in self._rooms[room]:
            if conn_id in self._connections:
                client = self._connections[conn_id]
                if client.username:
                    users.append(client.username)
        return users


# Global connection manager instance
manager = ConnectionManager()
