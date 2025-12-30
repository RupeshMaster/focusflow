/**
 * charts.js
 * A lightweight, zero-dependency chart drawer using HTML5 Canvas.
 * Handles Pie Charts and Bar Charts.
 */

export class ChartRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        if (!this.canvas) return;
        // Make high DPI compatible
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;
        this.width = rect.width;
        this.height = rect.height;
    }

    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
    }

    checkResize() {
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width !== this.width || rect.height !== this.height) {
            this.resize();
        }
    }

    drawPieChart(data, options = {}) {
        this.checkResize();
        this.clear();

        if (!data || data.length === 0) return;

        // Layout: Chart on left (60-70%), Legend on right
        const total = data.reduce((sum, item) => sum + item.value, 0);
        let startAngle = 0;

        // Dimensions
        const size = Math.min(this.width * 0.6, this.height * 0.9);
        const centerX = (this.width * 0.35); // Shift left
        const centerY = this.height / 2;
        const radius = size / 2;

        // Draw Slices
        data.forEach(item => {
            const sliceAngle = (item.value / total) * 2 * Math.PI;
            if (item.value > 0) {
                this.ctx.beginPath();
                this.ctx.moveTo(centerX, centerY);
                this.ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
                this.ctx.closePath();

                this.ctx.fillStyle = item.color;
                this.ctx.fill();
                startAngle += sliceAngle;
            }
        });

        // Draw Legend
        this.drawLegend(data, this.width * 0.65, 20);
    }

    drawLegend(data, x, y) {
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';
        this.ctx.font = '12px sans-serif'; // Fixed font size

        data.forEach((item, index) => {
            if (item.value === 0) return;

            const rowHeight = 20;
            const currentY = y + (index * rowHeight);

            // Color Box
            this.ctx.fillStyle = item.color;
            this.ctx.fillRect(x, currentY - 5, 10, 10);

            // Text
            this.ctx.fillStyle = '#6b7280'; // muted text
            this.ctx.fillText(`${item.label} (${item.value})`, x + 15, currentY);
        });
    }

    drawBarChart(data, options = {}) {
        this.checkResize();
        this.clear();

        if (!data || data.length === 0) return;

        const padding = 30; // Bottom/Left padding
        const chartW = this.width - padding * 2;
        const chartH = this.height - padding * 2;

        const maxValue = Math.max(...data.map(d => d.value)) || 1;
        const barWidth = (chartW / data.length) * 0.5;
        const gap = (chartW / data.length) * 0.5;

        // Draw Axis Lines
        this.ctx.beginPath();
        this.ctx.strokeStyle = '#e5e7eb';
        this.ctx.moveTo(padding, this.height - padding);
        this.ctx.lineTo(this.width - padding, this.height - padding);
        this.ctx.stroke();

        let x = padding + (gap / 2);

        data.forEach(item => {
            const barHeight = (item.value / maxValue) * chartH;
            const y = (this.height - padding) - barHeight;

            // Bar
            this.ctx.fillStyle = item.color || '#6366f1';
            this.ctx.fillRect(x, y, barWidth, barHeight);

            // Value Label (Above Bar)
            this.ctx.fillStyle = '#6b7280';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(item.value, x + barWidth / 2, y - 5);

            // Axis Label (Below Bar)
            this.ctx.fillStyle = '#374151';
            this.ctx.fillText(item.label, x + barWidth / 2, this.height - padding + 15);

            x += barWidth + gap;
        });
    }
}

