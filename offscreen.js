// offscreen.js - External file for CSP compliance
// Offscreen document for playing notification sounds
// This works even when the main extension is inactive

console.log('🔊 Audio offscreen document loaded');

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PLAY_NOTIFICATION_SOUND') {
        console.log('🔊 Playing notification sound...');
        playNotificationSound();
        sendResponse({success: true});
    }
});

function playNotificationSound() {
    try {
        // Create audio context for notification sound
        // Note: AudioContext requires user gesture, but offscreen documents may have different rules
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create a more attention-grabbing sound sequence
        const playTone = (frequency, duration, delay = 0) => {
            setTimeout(() => {
                try {
                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();
                    
                    oscillator.connect(gainNode);
                    gainNode.connect(audioContext.destination);
                    
                    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
                    oscillator.type = 'sine';
                    
                    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
                    gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.01);
                    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + duration);
                    
                    oscillator.start(audioContext.currentTime);
                    oscillator.stop(audioContext.currentTime + duration);
                } catch (error) {
                    console.error('❌ Error playing tone:', error);
                }
            }, delay);
        };

        // Play notification sound sequence
        playTone(800, 0.15, 0);
        playTone(1000, 0.15, 200);
        playTone(1200, 0.2, 400);

        console.log('🔊 Notification sound played successfully');

    } catch (error) {
        console.error('❌ Could not play notification sound:', error);
        
        // Fallback: Try playing a simple beep using the Web Audio API differently
        try {
            fallbackBeep();
        } catch (fallbackError) {
            console.error('❌ Fallback sound also failed:', fallbackError);
        }
    }
}

function fallbackBeep() {
    // Simple fallback beep
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
}