import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import type { Feature, PlanningEvent, ActivityType, User, UserGroup } from '../types.ts';
import { PlusIcon, ArrowLeftIcon, ArrowRightIcon, CalendarDaysIcon, TrashIcon, EditIcon } from './Icons.tsx';
import { useI18n } from '../src/i18n/index.tsx';

interface PlanningManagerProps {
    feature: Feature;
    planningEvents: PlanningEvent[];
    activityTypes: ActivityType[];
    users: User[];
    userGroups: UserGroup[];
    onSavePlanningEvent: (event: PlanningEvent) => void;
    onDeletePlanningEvent: (eventId: string) => void;
    apiCall: any; // AxiosInstance
}

const HOUR_HEIGHT = 60; // 60px per hour
const HEADER_HEIGHT = 40; // h-10 -> 2.5rem -> 40px

const ToggleSwitch: React.FC<{ enabled: boolean; onChange: (enabled: boolean) => void; disabled?: boolean; }> = ({ enabled, onChange, disabled }) => (
    <button
        type="button"
        onClick={() => !disabled && onChange(!enabled)}
        className={`${enabled ? 'bg-primary' : 'bg-slate-200'} ${disabled ? 'cursor-not-allowed opacity-50' : ''} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out`}
        role="switch"
        aria-checked={enabled}
        disabled={disabled}
    >
        <span
            aria-hidden="true"
            className={`${enabled ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
        />
    </button>
);


// --- PlanningEventModal ---
interface PlanningEventModalProps {
    event: Partial<PlanningEvent> | null;
    onSave: (eventData: Omit<PlanningEvent, 'id' | 'agentId'>, targetId: string) => void;
    onDelete: (eventId: string) => void;
    onClose: () => void;
    agents: User[];
    userGroups: UserGroup[];
    activities: ActivityType[];
}

const PlanningEventModal: React.FC<PlanningEventModalProps> = ({ event, onSave, onDelete, onClose, agents, userGroups, activities }) => {
    const { t } = useI18n();
    const isEditing = !!event?.id;
    
    const [targetId, setTargetId] = useState(() => (event?.agentId ? `user-${event.agentId}` : ''));
    
    const [formData, setFormData] = useState({
        activityId: event?.activityId || '',
        startDate: event?.startDate || new Date().toISOString(),
        endDate: event?.endDate || new Date().toISOString(),
    });

    const [isRecurring, setIsRecurring] = useState(event?.isRecurring || false);
    const [recurringDays, setRecurringDays] = useState<number[]>(event?.recurringDays || []);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 7);
    const [recurrenceEndDate, setRecurrenceEndDate] = useState(
        event?.recurrenceEndDate ? new Date(event.recurrenceEndDate).toISOString().split('T')[0] : tomorrow.toISOString().split('T')[0]
    );
    
    const WEEK_DAYS_SHORT = useMemo(() => [
        { label: t('weekdays.short.monday'), value: 1 }, { label: t('weekdays.short.tuesday'), value: 2 },
        { label: t('weekdays.short.wednesday'), value: 3 }, { label: t('weekdays.short.thursday'), value: 4 },
        { label: t('weekdays.short.friday'), value: 5 }, { label: t('weekdays.short.saturday'), value: 6 },
        { label: t('weekdays.short.sunday'), value: 7 }
    ], [t]);

    const handleDayToggle = (dayValue: number) => {
        setRecurringDays(prev => prev.includes(dayValue) ? prev.filter(d => d !== dayValue) : [...prev, dayValue]);
    };

    const handleSave = () => {
        if (!targetId || !formData.activityId) {
            alert(t('planning.modal.validationError'));
            return;
        }
        const saveData: Omit<PlanningEvent, 'id' | 'agentId'> = {
            ...formData,
            isRecurring: isRecurring && !isEditing, // Recurrence only for new events
            recurringDays: isRecurring && !isEditing ? recurringDays : undefined,
            recurrenceEndDate: isRecurring && !isEditing ? new Date(recurrenceEndDate).toISOString() : undefined
        };
        onSave(saveData, targetId);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                <div className="p-6">
                    <h3 className="text-lg font-medium text-slate-900">{isEditing ? t('planning.modal.editTitle') : t('planning.modal.newTitle')}</h3>
                    <div className="mt-4 space-y-4">
                        <div>
                            <label className="text-sm font-medium text-slate-700">{t('planning.modal.for')}</label>
                            <select value={targetId} onChange={e => setTargetId(e.target.value)} disabled={isEditing} className="mt-1 w-full p-2 border bg-white rounded-md disabled:bg-slate-100">
                                <option value="">{t('planning.modal.selectTarget')}</option>
                                <optgroup label={t('planning.groups')}>
                                    {userGroups.map(g => <option key={g.id} value={`group-${g.id}`}>{g.name}</option>)}
                                </optgroup>
                                <optgroup label={t('planning.agents')}>
                                    {agents.map(a => <option key={a.id} value={`user-${a.id}`}>{a.firstName} {a.lastName}</option>)}
                                </optgroup>
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700">{t('planning.modal.activity')}</label>
                            <select value={formData.activityId} onChange={e => setFormData(f => ({...f, activityId: e.target.value}))} className="mt-1 w-full p-2 border bg-white rounded-md">
                                 <option value="">{t('planning.modal.selectActivity')}</option>
                                {activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                         <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-slate-700">{t('planning.modal.start')}</label>
                                <input type="datetime-local" value={new Date(new Date(formData.startDate).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} onChange={e => setFormData(f => ({...f, startDate: new Date(e.target.value).toISOString()}))} className="mt-1 w-full p-2 border rounded-md"/>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700">{t('planning.modal.end')}</label>
                                <input type="datetime-local" value={new Date(new Date(formData.endDate).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} onChange={e => setFormData(f => ({...f, endDate: new Date(e.target.value).toISOString()}))} className="mt-1 w-full p-2 border rounded-md"/>
                            </div>
                        </div>
                        <div className="pt-4 border-t">
                            <div className="flex items-center justify-between">
                                <label className={`text-sm font-medium ${isEditing ? 'text-slate-400' : 'text-slate-700'}`}>{t('planning.modal.recurringEvent')}</label>
                                <ToggleSwitch enabled={isRecurring} onChange={setIsRecurring} disabled={isEditing} />
                            </div>
                            {isRecurring && !isEditing && (
                                <div className="mt-4 space-y-4">
                                    <div>
                                        <label className="text-sm font-medium text-slate-700">{t('planning.modal.repeatOn')}</label>
                                        <div className="mt-2 flex justify-between">
                                            {WEEK_DAYS_SHORT.map(day => (
                                                <button key={day.value} type="button" onClick={() => handleDayToggle(day.value)} className={`w-8 h-8 rounded-full font-bold text-xs transition-colors ${recurringDays.includes(day.value) ? 'bg-primary text-primary-text' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>
                                                    {day.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-700">{t('planning.modal.recurrenceEnd')}</label>
                                        <input type="date" value={recurrenceEndDate} onChange={e => setRecurrenceEndDate(e.target.value)} className="mt-1 w-full p-2 border rounded-md"/>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="bg-slate-50 p-3 flex justify-between">
                     {isEditing && event?.id && <button onClick={() => { onDelete(event.id!); onClose(); }} className="bg-red-100 text-red-700 px-4 py-2 rounded-md hover:bg-red-200">{t('common.delete')}</button>}
                    <div className="flex justify-end gap-2 w-full">
                        <button onClick={onClose} className="bg-white border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50">{t('common.cancel')}</button>
                        <button onClick={handleSave} className="bg-primary text-primary-text px-4 py-2 rounded-md hover:bg-primary-hover">{t('common.save')}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- MassEditModal ---
interface MassEditModalProps {
    onClose: () => void;
    onSave: (findActivityId: string, replaceWithActivityId: string) => void;
    activities: ActivityType[];
    eventCount: number;
    userCount: number;
}

const MassEditModal: React.FC<MassEditModalProps> = ({ onClose, onSave, activities, eventCount, userCount }) => {
    const { t } = useI18n();
    const [findActivityId, setFindActivityId] = useState('all');
    const [replaceWithActivityId, setReplaceWithActivityId] = useState('');

    const handleSave = () => {
        if (!replaceWithActivityId) {
            alert(t('planning.modal.validationErrorActivity'));
            return;
        }
        onSave(findActivityId, replaceWithActivityId);
    };

    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                <div className="p-6">
                    <h3 className="text-lg font-medium text-slate-900">{t('planning.modal.massEditTitle')}</h3>
                    <p className="text-sm text-slate-500 mt-2">
                        {t('planning.modal.massEditDescription', { eventCount, userCount })}
                    </p>
                    <div className="mt-4 space-y-4">
                        <div>
                            <label className="text-sm font-medium text-slate-700">{t('planning.modal.findActivity')}</label>
                            <select value={findActivityId} onChange={e => setFindActivityId(e.target.value)} className="mt-1 w-full p-2 border bg-white rounded-md">
                                <option value="all">{t('planning.modal.allActivities')}</option>
                                {activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700">{t('planning.modal.replaceWith')}</label>
                            <select value={replaceWithActivityId} onChange={e => setReplaceWithActivityId(e.target.value)} className="mt-1 w-full p-2 border bg-white rounded-md">
                                <option value="">{t('planning.modal.selectActivity')}</option>
                                {activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
                 <div className="bg-slate-50 p-3 flex justify-end gap-2">
                    <button onClick={onClose} className="bg-white border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50">{t('common.cancel')}</button>
                    <button onClick={handleSave} className="bg-primary text-primary-text px-4 py-2 rounded-md hover:bg-primary-hover">{t('common.save')}</button>
                </div>
            </div>
        </div>
    );
};


const PlanningManager: React.FC<PlanningManagerProps> = ({ feature, planningEvents, activityTypes, users, userGroups, onSavePlanningEvent, onDeletePlanningEvent, apiCall }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedTargetId, setSelectedTargetId] = useState('all');
    const [modalState, setModalState] = useState<{ isOpen: boolean; event: Partial<PlanningEvent> | null }>({ isOpen: false, event: null });
    const { t } = useI18n();

    // State for mass actions
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [isMassEditModalOpen, setIsMassEditModalOpen] = useState(false);

    const WEEKDAYS = useMemo(() => [
        t('weekdays.monday'), t('weekdays.tuesday'), t('weekdays.wednesday'), t('weekdays.thursday'), t('weekdays.friday'), t('weekdays.saturday'), t('weekdays.sunday')
    ], [t]);
    
    const [ghostEvent, setGhostEvent] = useState<PlanningEvent | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const dragState = useRef<{
        type: 'move' | 'resize', 
        originalEvent: PlanningEvent,
        timeOffset?: number,
    } | null>(null);

    const gridRef = useRef<HTMLDivElement>(null);
    const activeAgents = useMemo(() => users.filter(u => u.role === 'Agent' && u.isActive), [users]);

    const weekInfo = useMemo(() => {
        const start = new Date(currentDate);
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1);
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);

        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        
        const days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            return d;
        });

        return { start, end, days };
    }, [currentDate]);

    const handleDateChange = (offset: number) => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setDate(prev.getDate() + offset);
            return newDate;
        });
    };

    const getDateFromPosition = useCallback((clientX: number, clientY: number): Date | null => {
        if (!gridRef.current) return null;
        
        const gridRect = gridRef.current.getBoundingClientRect();
        const dayWidth = gridRect.width / 7;
        const snapMinutes = 15;

        const clampedClientX = Math.max(gridRect.left, Math.min(clientX, gridRect.right - 1));
        const clampedClientY = Math.max(gridRect.top + HEADER_HEIGHT, Math.min(clientY, gridRect.bottom - 1));

        const relativeX = clampedClientX - gridRect.left;
        const relativeY = clampedClientY - (gridRect.top + HEADER_HEIGHT);
        
        const dayIndex = Math.floor(relativeX / dayWidth);
        const minutesInDay = (relativeY / HOUR_HEIGHT) * 60;
        
        const snappedMinutes = Math.round(minutesInDay / snapMinutes) * snapMinutes;

        const date = new Date(weekInfo.start);
        date.setDate(date.getDate() + dayIndex);
        date.setHours(Math.floor(snappedMinutes / 60), snappedMinutes % 60, 0, 0);
        
        return date;
    }, [weekInfo.start]);
    
    const handleCellClick = (day: Date, hour: number) => {
        const startDate = new Date(day);
        startDate.setHours(hour, 0, 0, 0);
        const endDate = new Date(startDate);
        endDate.setHours(hour + 1, 0, 0, 0);
        
        let agentId = '';
        if (selectedTargetId.startsWith('user-')) {
            agentId = selectedTargetId.substring(5);
        }
        
        setModalState({ isOpen: true, event: { agentId, startDate: startDate.toISOString(), endDate: endDate.toISOString() } });
    }
    
    const handleModalSave = (eventData: Omit<PlanningEvent, 'id' | 'agentId'>, targetId: string) => {
        const isEditing = !!modalState.event?.id;
    
        if (isEditing && modalState.event) {
            const updatedEvent: PlanningEvent = {
                ...modalState.event,
                id: modalState.event.id!,
                agentId: modalState.event.agentId!,
                activityId: eventData.activityId,
                startDate: eventData.startDate,
                endDate: eventData.endDate,
            };
            onSavePlanningEvent(updatedEvent);
            return;
        }
    
        const agentsToSchedule: string[] = [];
        const type = targetId.substring(0, targetId.indexOf('-'));
        const id = targetId.substring(targetId.indexOf('-') + 1);
    
        if (type === 'group') {
            const group = userGroups.find(g => g.id === id);
            if (group) agentsToSchedule.push(...group.memberIds);
        } else if (type === 'user') {
            agentsToSchedule.push(id);
        }
    
        if (agentsToSchedule.length === 0) return;
    
        if (eventData.isRecurring && eventData.recurringDays?.length && eventData.recurrenceEndDate) {
            const recurrenceStart = new Date(eventData.startDate);
            const recurrenceEnd = new Date(eventData.recurrenceEndDate);
            recurrenceEnd.setHours(23, 59, 59, 999);
    
            const durationMs = new Date(eventData.endDate).getTime() - new Date(eventData.startDate).getTime();
    
            let currentDate = new Date(recurrenceStart);
            while (currentDate <= recurrenceEnd) {
                const dayOfWeek = currentDate.getDay() === 0 ? 7 : currentDate.getDay();
    
                if (eventData.recurringDays.includes(dayOfWeek)) {
                    const instanceStartDate = new Date(currentDate);
                    instanceStartDate.setHours(recurrenceStart.getHours(), recurrenceStart.getMinutes(), 0, 0);
                    
                    const instanceEndDate = new Date(instanceStartDate.getTime() + durationMs);
    
                    for (const agentId of agentsToSchedule) {
                        onSavePlanningEvent({
                            id: `plan-${Date.now()}-${Math.random()}`,
                            agentId: agentId,
                            activityId: eventData.activityId,
                            startDate: instanceStartDate.toISOString(),
                            endDate: instanceEndDate.toISOString(),
                        });
                    }
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }
        } else {
            for (const agentId of agentsToSchedule) {
                onSavePlanningEvent({
                    id: `plan-${Date.now()}-${Math.random()}`,
                    agentId: agentId,
                    activityId: eventData.activityId,
                    startDate: eventData.startDate,
                    endDate: eventData.endDate,
                });
            }
        }
    };
    
    const handleEventMouseDown = useCallback((e: React.MouseEvent, event: PlanningEvent, isResizeHandle: boolean) => {
        e.stopPropagation();
        e.preventDefault();
        if (dragState.current) return;
        
        const startMouseDate = getDateFromPosition(e.clientX, e.clientY);
        if (!startMouseDate) return;

        dragState.current = { 
            type: isResizeHandle ? 'resize' : 'move', 
            originalEvent: event,
            timeOffset: isResizeHandle ? undefined : startMouseDate.getTime() - new Date(event.startDate).getTime(),
        };
        setGhostEvent(event);
        setIsDragging(true);
    }, [getDateFromPosition]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!dragState.current) return;
        e.preventDefault();
        
        const { type, originalEvent, timeOffset } = dragState.current;
        const currentMouseDate = getDateFromPosition(e.clientX, e.clientY);
        if (!currentMouseDate) return;

        if (type === 'move') {
            const newStartMillis = currentMouseDate.getTime() - timeOffset!;
            const originalDuration = new Date(originalEvent.endDate).getTime() - new Date(originalEvent.startDate).getTime();
            const newStartDate = new Date(newStartMillis);
            const newEndDate = new Date(newStartMillis + originalDuration);

            setGhostEvent(prev => prev ? { 
                ...prev, 
                startDate: newStartDate.toISOString(), 
                endDate: newEndDate.toISOString() 
            } : null);
        } else { // resize
            const originalStartDate = new Date(originalEvent.startDate);
            let newEndDate = currentMouseDate;

            if (newEndDate.getTime() < originalStartDate.getTime() + 15 * 60000) {
                newEndDate = new Date(originalStartDate.getTime() + 15 * 60000);
            }
            setGhostEvent(prev => prev ? { ...prev, endDate: newEndDate.toISOString() } : null);
        }
    }, [getDateFromPosition]);
    
    const handleMouseUp = useCallback(() => {
        if (dragState.current && ghostEvent) {
            const { originalEvent } = dragState.current;
            if(ghostEvent.startDate !== originalEvent.startDate || ghostEvent.endDate !== originalEvent.endDate) {
                onSavePlanningEvent(ghostEvent);
            }
        }
        dragState.current = null;
        setGhostEvent(null);
        setIsDragging(false);
    }, [ghostEvent, onSavePlanningEvent]);

    useEffect(() => {
        if (isDragging) {
            document.body.style.cursor = dragState.current?.type === 'resize' ? 'ns-resize' : 'grabbing';
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp, { once: true });
        } else {
            document.body.style.cursor = 'default';
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'default';
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);
    
    const eventsToDisplay = useMemo(() => {
        let baseEvents = planningEvents.filter(event => {
            const eventEnd = new Date(event.endDate);
            const eventStart = new Date(event.startDate);
            if (eventEnd < weekInfo.start || eventStart > weekInfo.end) return false;
            if (selectedTargetId === 'all') return true;
            if (selectedTargetId.startsWith('user-')) return event.agentId === selectedTargetId.substring(5);
            if (selectedTargetId.startsWith('group-')) {
                const groupId = selectedTargetId.substring(6);
                const group = userGroups.find(g => g.id === groupId);
                return group ? group.memberIds.includes(event.agentId) : false;
            }
            return false;
        });

        if (ghostEvent) {
            baseEvents = baseEvents.filter(e => e.id !== ghostEvent.id);
            baseEvents.push(ghostEvent);
        }
        return baseEvents;
    }, [planningEvents, weekInfo, selectedTargetId, userGroups, ghostEvent]);

    const eventsToRender = useMemo(() => {
        const segmentsWithLayout: Array<{ 
            id: string; 
            originalEvent: PlanningEvent; 
            startDate: Date; 
            endDate: Date; 
            isStart: boolean; 
            isEnd: boolean;
            totalInGroup: number;
            indexInGroup: number;
        }> = [];
        
        eventsToDisplay.forEach(event => {
            const start = new Date(event.startDate);
            const end = new Date(event.endDate);
            
            const overlaps = eventsToDisplay.filter(e => 
                e.id !== event.id && 
                new Date(e.startDate) < end && 
                new Date(e.endDate) > start
            ).sort((a,b) => a.id.localeCompare(b.id));

            const collisionGroup = [event, ...overlaps];
            const totalInGroup = collisionGroup.length;
            const indexInGroup = collisionGroup.findIndex(e => e.id === event.id);

            const renderStart = start > weekInfo.start ? start : weekInfo.start;
            const renderEnd = end < weekInfo.end ? end : weekInfo.end;

            let currentDay = new Date(renderStart);
            currentDay.setHours(0, 0, 0, 0);

            while (currentDay < renderEnd) {
                const dayEnd = new Date(currentDay);
                dayEnd.setDate(dayEnd.getDate() + 1);

                const segmentStart = currentDay > renderStart ? currentDay : renderStart;
                const segmentEnd = dayEnd < renderEnd ? dayEnd : renderEnd;

                if (segmentStart < segmentEnd) {
                    segmentsWithLayout.push({
                        id: `${event.id}-${currentDay.toISOString().split('T')[0]}`,
                        originalEvent: event,
                        startDate: segmentStart,
                        endDate: segmentEnd,
                        isStart: start.getTime() >= segmentStart.getTime() && start.getTime() < segmentEnd.getTime(),
                        isEnd: end.getTime() > segmentStart.getTime() && end.getTime() <= segmentEnd.getTime(),
                        totalInGroup,
                        indexInGroup,
                    });
                }
                currentDay.setDate(currentDay.getDate() + 1);
            }
        });
        return segmentsWithLayout;
    }, [eventsToDisplay, weekInfo.start, weekInfo.end]);

    // --- MASS ACTIONS ---
    const scheduledUsersInView = useMemo(() => {
        const userIdsInView = new Set<string>();
        planningEvents.forEach(event => {
            const eventEnd = new Date(event.endDate);
            const eventStart = new Date(event.startDate);
            if (eventEnd >= weekInfo.start && eventStart <= weekInfo.end) {
                userIdsInView.add(event.agentId);
            }
        });
        return users.filter(u => userIdsInView.has(u.id)).sort((a,b) => a.lastName.localeCompare(b.lastName));
    }, [planningEvents, users, weekInfo.start, weekInfo.end]);

    const handleUserSelection = (userId: string, isSelected: boolean) => {
        setSelectedUserIds(prev => isSelected ? [...prev, userId] : prev.filter(id => id !== userId));
    };
    
    const handleSelectAll = (isSelected: boolean) => {
        setSelectedUserIds(isSelected ? scheduledUsersInView.map(u => u.id) : []);
    };

    const eventsForSelectedUsers = useMemo(() => {
        if (selectedUserIds.length === 0) return [];
        return planningEvents.filter(event => {
            const eventEnd = new Date(event.endDate);
            const eventStart = new Date(event.startDate);
            return selectedUserIds.includes(event.agentId) && eventEnd >= weekInfo.start && eventStart <= weekInfo.end;
        });
    }, [selectedUserIds, planningEvents, weekInfo.start, weekInfo.end]);

    const handleMassDelete = async () => {
        const eventIdsToDelete = eventsForSelectedUsers.map(e => e.id);
        if (eventIdsToDelete.length === 0) return;
        
        if (window.confirm(t('planning.actions.confirmDelete', { eventCount: eventIdsToDelete.length, userCount: selectedUserIds.length }))) {
            try {
                // Call the new bulk delete endpoint
                await apiCall.post('/planning-events/bulk-delete', { eventIds: eventIdsToDelete });
                // Note: The frontend will auto-refresh via the application-data call in App.tsx after a successful API call.
                // For a more instant UI, you'd filter the state here, but that's handled by the parent.
                setSelectedUserIds([]);
            } catch (error) {
                console.error("Mass delete failed:", error);
                alert("An error occurred during mass deletion.");
            }
        }
    };

    const handleMassUpdate = (findActivityId: string, replaceWithActivityId: string) => {
        const eventsToUpdate = eventsForSelectedUsers.filter(event => findActivityId === 'all' || event.activityId === findActivityId);
        
        eventsToUpdate.forEach(event => {
            onSavePlanningEvent({ ...event, activityId: replaceWithActivityId });
        });
        
        setIsMassEditModalOpen(false);
        setSelectedUserIds([]);
    };


    return (
        <div className="max-w-7xl mx-auto space-y-6 flex flex-col h-full">
            {modalState.isOpen && (
                <PlanningEventModal
                    event={modalState.event}
                    onSave={handleModalSave}
                    onDelete={onDeletePlanningEvent}
                    onClose={() => setModalState({ isOpen: false, event: null })}
                    agents={activeAgents}
                    userGroups={userGroups}
                    activities={activityTypes}
                />
            )}
            {isMassEditModalOpen && (
                <MassEditModal
                    onClose={() => setIsMassEditModalOpen(false)}
                    onSave={handleMassUpdate}
                    activities={activityTypes}
                    eventCount={eventsForSelectedUsers.length}
                    userCount={selectedUserIds.length}
                />
            )}
            <header>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight flex items-center"><CalendarDaysIcon className="w-9 h-9 mr-3"/>{t(feature.titleKey)}</h1>
                <p className="mt-2 text-lg text-slate-600">{t(feature.descriptionKey)}</p>
            </header>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <button onClick={() => handleDateChange(-7)} className="p-2 rounded-md hover:bg-slate-100"><ArrowLeftIcon className="w-5 h-5"/></button>
                    <span className="text-lg font-semibold text-slate-700">
                        {weekInfo.start.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })} - {weekInfo.end.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </span>
                    <button onClick={() => handleDateChange(7)} className="p-2 rounded-md hover:bg-slate-100"><ArrowRightIcon className="w-5 h-5"/></button>
                     <button onClick={() => setCurrentDate(new Date())} className="text-sm font-semibold text-link hover:underline">{t('planning.today')}</button>
                </div>
                <div>
                     <label className="text-sm font-medium text-slate-600 mr-2">{t('planning.show')}</label>
                     <select value={selectedTargetId} onChange={e => setSelectedTargetId(e.target.value)} className="p-2 border bg-white rounded-md">
                        <option value="all">{t('planning.all')}</option>
                        <optgroup label={t('planning.groups')}>
                           {userGroups.map(g => <option key={g.id} value={`group-${g.id}`}>{g.name}</option>)}
                        </optgroup>
                         <optgroup label={t('planning.agents')}>
                            {activeAgents.map(a => <option key={a.id} value={`user-${a.id}`}>{a.firstName} {a.lastName}</option>)}
                        </optgroup>
                     </select>
                </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex-1 grid grid-cols-[1fr_280px]">
                <div className="h-full overflow-auto relative grid grid-cols-[auto_1fr] text-sm select-none">
                    <div className="sticky left-0 top-0 z-20 bg-white border-r">
                        <div className="h-10 border-b flex items-center justify-center font-semibold text-slate-500">{t('planning.hour')}</div>
                        {Array.from({ length: 24 }).map((_, hour) => (
                            <div key={hour} className="h-[60px] text-right pr-2 text-xs text-slate-400 border-t pt-1 font-mono">
                                {`${hour.toString().padStart(2, '0')}:00`}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 relative" ref={gridRef}>
                        {weekInfo.days.map((day, i) => (
                            <div key={i} className="sticky top-0 h-10 bg-white border-b border-r flex items-center justify-center font-semibold z-10">
                                {WEEKDAYS[i]} <span className="text-slate-500 ml-2">{day.getDate()}</span>
                            </div>
                        ))}
                        {weekInfo.days.map((day, dayIndex) => (
                            <div key={dayIndex} className="relative border-r day-column">
                                {Array.from({ length: 24 }).map((_, hour) => (
                                    <div key={hour} onClick={() => handleCellClick(day, hour)} className="h-[60px] border-t hover:bg-indigo-50"/>
                                ))}
                            </div>
                        ))}
                        <div className="absolute top-[40px] left-0 right-0 bottom-0 pointer-events-none">
                           {eventsToRender.map(segment => {
                                const { originalEvent, startDate, endDate, isStart, isEnd, totalInGroup, indexInGroup } = segment;
                                const isDraggingGhost = ghostEvent?.id === originalEvent.id;
                                const startDayIndex = (startDate.getDay() + 6) % 7;
                                const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
                                const durationMinutes = (endDate.getTime() - startDate.getTime()) / 60000;
                                
                                const top = (startMinutes / 60) * HOUR_HEIGHT;
                                const height = (durationMinutes / 60) * HOUR_HEIGHT;

                                const dayBaseWidth = 100 / 7;
                                const eventWidth = dayBaseWidth / totalInGroup;
                                const eventLeftOffset = (indexInGroup * eventWidth);
                                const left = `calc(${(startDayIndex * dayBaseWidth)}% + ${eventLeftOffset}%)`;
                                const width = `${eventWidth}%`;
                                
                                const activity = activityTypes.find(a => a.id === originalEvent.activityId);
                                const agent = users.find(u => u.id === originalEvent.agentId);
                                const agentName = agent ? `${agent.firstName} ${agent.lastName}` : 'Agent inconnu';
                                
                                const startTimeStr = startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit'});
                                const endTimeStr = endDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit'});
                                const tooltipText = `${activity?.name}\n${agentName}\n${startTimeStr} - ${endTimeStr}`;

                                return (
                                    <div
                                        key={segment.id}
                                        onClick={e => { e.stopPropagation(); setModalState({ isOpen: true, event: originalEvent })}}
                                        onMouseDown={e => handleEventMouseDown(e, originalEvent, false)}
                                        className={`group absolute p-1 rounded-sm shadow-sm border overflow-hidden flex flex-col pointer-events-auto transition-all duration-75 ${isDraggingGhost ? 'opacity-70 z-30' : 'cursor-pointer'}`}
                                        style={{ top: `${top}px`, height: `${Math.max(height, 15)}px`, left, width, backgroundColor: activity?.color || '#ccc', borderColor: activity ? `${activity.color}99` : '#bbb' }}
                                        title={tooltipText}
                                    >
                                        {isStart && <p className="font-bold text-white text-xs truncate">{activity?.name}</p>}
                                        {isStart && totalInGroup > 1 && <p className="text-white text-xs opacity-80 truncate">{agent?.firstName}</p>}
                                        {isEnd && height > 20 && (
                                            <div 
                                                onMouseDown={e => handleEventMouseDown(e, originalEvent, true)} 
                                                className="absolute bottom-0 left-0 right-0 h-2 flex justify-center items-center cursor-ns-resize opacity-0 group-hover:opacity-100 pointer-events-auto"
                                            >
                                               <div className="h-1 w-8 bg-white opacity-50 rounded-full"/>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
                 <div className="border-l bg-slate-50 flex flex-col">
                    <h3 className="text-lg font-semibold text-slate-800 p-4 border-b flex-shrink-0">{t('planning.legend.title')}</h3>
                    <div className="p-4 border-b text-sm">
                        <label className="flex items-center font-medium">
                            <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-slate-300 mr-3"
                                checked={scheduledUsersInView.length > 0 && selectedUserIds.length === scheduledUsersInView.length}
                                onChange={e => handleSelectAll(e.target.checked)}
                            />
                            {t('planning.legend.selectAll')}
                        </label>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {scheduledUsersInView.map(user => (
                            <label key={user.id} className="flex items-center p-2 rounded-md hover:bg-slate-100 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-slate-300 mr-3"
                                    checked={selectedUserIds.includes(user.id)}
                                    onChange={e => handleUserSelection(user.id, e.target.checked)}
                                />
                                <span className="text-sm font-medium text-slate-700">{user.lastName} {user.firstName}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>
             {selectedUserIds.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-lg shadow-2xl p-3 flex items-center gap-4 border z-40 animate-fade-in-up">
                    <p className="font-semibold text-slate-700">{t('planning.actions.selection', { count: selectedUserIds.length })}</p>
                    <button onClick={() => setIsMassEditModalOpen(true)} className="flex items-center gap-2 text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 py-2 px-4 rounded-md"><EditIcon className="w-4 h-4"/>{t('planning.actions.massEdit')}</button>
                    <button onClick={handleMassDelete} className="flex items-center gap-2 text-sm font-semibold bg-red-100 hover:bg-red-200 text-red-700 py-2 px-4 rounded-md"><TrashIcon className="w-4 h-4"/>{t('planning.actions.massDelete')}</button>
                </div>
            )}
        </div>
    );
};

export default PlanningManager;
