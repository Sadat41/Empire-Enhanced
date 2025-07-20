// starfield.js 

class Starfield {
    constructor() {
        this.starCount = 200; // Number of stars to generate
        this.starContainer = null;
        this.init();
    }

    init() {
        // Wait for the DOM to be fully loaded before initializing
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupStarfield());
        } else {
            this.setupStarfield();
        }

        // Listen for theme changes to enable/disable starfield
        // This assumes history.js (or another script) will update the body class
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.attributeName === 'class') {
                    this.updateStarfieldVisibility();
                }
            });
        });
        observer.observe(document.body, { attributes: true });

        // Update starfield on window resize for responsiveness
        window.addEventListener('resize', () => this.updateStarfieldVisibility());
    }

    setupStarfield() {
        // Create a container for the stars if it doesn't exist
        this.starContainer = document.querySelector('.starfield-container');
        if (!this.starContainer) {
            this.starContainer = document.createElement('div');
            this.starContainer.classList.add('starfield-container');
            document.body.appendChild(this.starContainer);
        }

        this.generateStars();
        this.updateStarfieldVisibility();
        console.log('✨ Starfield initialized.');
    }

    generateStars() {
        // Clear existing stars before generating new ones
        this.starContainer.innerHTML = '';

        for (let i = 0; i < this.starCount; i++) {
            const star = document.createElement('div');
            star.classList.add('star');

            // Random size for the star (1px to 3px)
            const size = Math.random() * 2 + 1; // 1 to 3
            star.style.width = `${size}px`;
            star.style.height = `${size}px`;

            // Random position across the entire viewport
            star.style.top = `${Math.random() * 100}vh`;
            star.style.left = `${Math.random() * 100}vw`;

            // Random animation delay for a more natural twinkle effect
            star.style.animationDelay = `${Math.random() * 4}s`;
            star.style.animationDuration = `${3 + Math.random() * 2}s`; // 3 to 5 seconds

            // Random brightness/color variation (subtle)
            const brightness = 200 + Math.random() * 55; // 200 to 255
            star.style.backgroundColor = `rgb(${brightness}, ${brightness}, ${brightness})`;

            this.starContainer.appendChild(star);
        }
        console.log(`✨ Generated ${this.starCount} stars.`);
    }

    updateStarfieldVisibility() {
        if (document.body.classList.contains('theme-shooting-star')) {
            if (this.starContainer) {
                this.starContainer.style.display = 'block';
                console.log('✨ Starfield visible (Shooting Star theme active).');
            }
        } else {
            if (this.starContainer) {
                this.starContainer.style.display = 'none';
                console.log('✨ Starfield hidden (Shooting Star theme not active).');
            }
        }
    }
}


new Starfield();