/**
 * scheduler.js
 * Logic for generating the timetable based on constraints.
 */

export class Scheduler {
    constructor() {
        this.SLOT_BREAK_MIN = 10;
    }

    /**
     * Generates a daily timetable.
     * @param {Object} profile - Student profile (age, schoolHours, studyHours).
     * @param {Array} subjects - List of subjects with priorities.
     * @param {Date} date - Specific date to generate for.
     */
    generateDaily(profile, subjects, date) {
        if (!profile || !subjects || subjects.length === 0) return null;

        // 1. Determine Slot Duration based on Age
        const slotDuration = this.getSlotDuration(profile.age);
        const availableSlots = this.calculateAvailableSlots(profile, slotDuration);

        // 2. Weighting Strategy
        // Priority: High(3), Medium(2), Low(1)
        // Weakness: Weak(2), Strong(1)
        // Mood: Dislike(+1 to ensure coverage)

        let totalWeight = 0;
        const weightedSubjects = subjects.map(sub => {
            let weight = 0;
            switch (sub.priority) {
                case 'High': weight += 3; break;
                case 'Medium': weight += 2; break;
                case 'Low': weight += 1; break;
                default: weight += 1;
            }
            if (sub.weakness === 'Weak') weight += 2;
            else weight += 1;

            if (sub.mood === 'Dislike') weight += 1;

            totalWeight += weight;
            return { ...sub, weight };
        });

        // 3. Slot Allocation
        // Distribute available time slots based on subject weight.

        let slotsBuffer = [...availableSlots];
        let scheduledItems = [];

        // Sort by weight to prioritize heavy subjects
        weightedSubjects.sort((a, b) => b.weight - a.weight);

        // Normalize weights into a distribution pool
        let distributionPool = [];
        weightedSubjects.forEach(sub => {
            for (let i = 0; i < sub.weight; i++) distributionPool.push(sub);
        });

        // Interleave/Shuffle to prevent adjacent duplicates
        distributionPool = this.shuffleIdeally(distributionPool);

        let poolIndex = 0;

        // Iterate through valid time blocks
        for (let block of slotsBuffer) {
            let currentTime = this.timeToMin(block.start);
            const endTime = this.timeToMin(block.end);

            while (currentTime + slotDuration <= endTime) {
                if (distributionPool.length === 0) break;

                let subject = distributionPool[poolIndex % distributionPool.length];

                scheduledItems.push({
                    subjectId: subject.id,
                    subjectName: subject.name,
                    color: subject.color || '#3b82f6',
                    startTime: this.minToTime(currentTime),
                    endTime: this.minToTime(currentTime + slotDuration),
                    status: 'pending'
                });

                currentTime += slotDuration;

                // Insert Break if space permits
                if (currentTime + this.SLOT_BREAK_MIN < endTime) {
                    currentTime += this.SLOT_BREAK_MIN;
                }

                poolIndex++;
            }
        }

        return {
            date: date.toISOString().split('T')[0],
            dayName: date.toLocaleDateString('en-US', { weekday: 'long' }),
            slots: scheduledItems
        };
    }

    /**
     * Generates a weekly timetable (7 days starting from today).
     */
    generateWeekly(profile, subjects, startDate) {
        if (!profile || !subjects || subjects.length === 0) return [];

        const weekSchedule = [];
        const current = new Date(startDate);

        // Generate 7 days
        for (let i = 0; i < 7; i++) {
            // Shuffle subjects differently each day to avoid monotony?
            // We can rotate the priority list or just rely on random shuffle.

            // Logic: Maybe give "Weak" subjects more slots on weekends?
            // For MVP: Just generate daily logic 7 times.
            const dailyPlan = this.generateDaily(profile, subjects, new Date(current));
            if (dailyPlan) weekSchedule.push(dailyPlan);

            // Next Day
            current.setDate(current.getDate() + 1);
        }

        return weekSchedule;
    }

    getSlotDuration(age) {
        if (age < 14) return 30;
        if (age <= 18) return 45;
        return 60; // > 18
    }

    calculateAvailableSlots(profile, slotDuration) {
        // 1. Custom Study Window (Highest Priority)
        // If user defined specific "From" and "To" times.
        if (profile.studyStart && profile.studyEnd) {
            const startMin = this.timeToMin(profile.studyStart);
            const endMin = this.timeToMin(profile.studyEnd);

            // CASE 1: Standard Day Range (e.g. 09:00 AM to 05:00 PM)
            if (endMin > startMin + slotDuration) {
                return [{ start: profile.studyStart, end: profile.studyEnd }];
            }

            // CASE 2: Overnight Range (e.g. 23:00 to 06:00)
            if (startMin > endMin) {
                // Split into two blocks using 24-hour format:
                // 1. Morning part: 00:00 to StudyEnd
                // 2. Night part: StudyStart to 23:59
                return [
                    { start: profile.studyStart, end: "23:59" },
                    { start: "00:00", end: profile.studyEnd }
                ];
            }
        }

        // 2. Explicit Available Slots (Future features)
        if (profile.availableSlots && profile.availableSlots.length > 0) {
            return profile.availableSlots;
        }

        // 3. Fallback: Auto-generate based on School Hours
        // Default Day: 06:00 to 22:00
        const dayStart = 6 * 60; // 06:00
        const dayEnd = 22 * 60; // 22:00

        const schoolStart = this.timeToMin(profile.schoolStart || "08:00");
        const schoolEnd = this.timeToMin(profile.schoolEnd || "15:00");

        let blocks = [];

        // Morning Block
        if (schoolStart - dayStart >= slotDuration) {
            blocks.push({ start: this.minToTime(dayStart), end: this.minToTime(schoolStart) });
        }

        // Evening Block
        if (dayEnd - schoolEnd >= slotDuration) {
            blocks.push({ start: this.minToTime(schoolEnd + 60), end: this.minToTime(dayEnd) });
            // +60 mins for commute/relax immediately after school
        }

        return blocks;
    }

    // Array shuffling preventing immediate repeats
    shuffleIdeally(array) {
        // Simple shuffle for now
        let currentIndex = array.length, randomIndex;
        // While there remain elements to shuffle.
        while (currentIndex != 0) {
            // Pick a remaining element.
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            // And swap it with the current element.
            [array[currentIndex], array[randomIndex]] = [
                array[randomIndex], array[currentIndex]];
        }
        return array;
    }

    timeToMin(timeStr) {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    }

    minToTime(mins) {
        let h = Math.floor(mins / 60);
        let m = mins % 60;
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        h = h ? h : 12; // the hour '0' should be '12'
        return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
    }
}

export const scheduler = new Scheduler();
