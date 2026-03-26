import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
  Directive,
  ElementRef,
  HostBinding,
  inject,
  Injectable,
  Input,
  NgZone,
  OnChanges,
  signal,
  SimpleChanges,
  ViewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { BehaviorSubject, fromEvent, Observable, Subject } from "rxjs";
import { takeUntil, tap } from "rxjs/operators";

import { ColorService } from "./color.service";
import { DirtyCheckColoringService } from "./dirty-check-coloring.service";
import { NumberHolder } from "./number-holder";
import { WarningService } from "./warning.service";

@Directive()
export abstract class AbstractChangeDetectionComponent implements AfterViewInit, OnChanges {
  private destroyRef = inject(DestroyRef);
  private _destroyInputObservable$ = new Subject<void>();
  private cdRef = inject(ChangeDetectorRef);

  @ViewChild("execute_button", { static: true })
  private _executeButton!: ElementRef<HTMLButtonElement>;
  @ViewChild("hidden_button", { static: true }) private _hiddenButton!: ElementRef<HTMLButtonElement>;
  @ViewChild("action_list", { static: true }) private _actionSelect!: ElementRef<HTMLSelectElement>;

  @ViewChild("cd_state_box", { static: true }) private _cdStateBox!: ElementRef;

  @ViewChild("ng_on_changes_box", { static: true }) private _ngOnChangesBox!: ElementRef;
  @ViewChild("ng_marked", { static: true }) private _ngMarked!: ElementRef;

  @Input() public inputByRef!: NumberHolder;
  @Input() public inputByVal!: number;
  @Input() public inputObservable!: Observable<number>;

  @HostBinding("attr.class")
  public get hostClass(): string {
    return `${this.cdStrategyName} level-${this._level}`;
  }

  public inputObservableValue!: number;
  public cdStrategyName: string;
  public title: string;

  private static readonly _titleMap = new Map<string, string[]>([
    ["comp-1", ["1"]],
    ["comp-1-1", ["L1"]],
    ["comp-1-2", ["R1"]],
    ["comp-1-x-1", ["L2", "L3"]],
    ["comp-1-x-2", ["R2", "R3"]],
    ["comp-1-x-1-1", ["L4", "L6"]],
    ["comp-1-x-1-2", ["R4", "R6"]],
    ["comp-1-x-2-1", ["L5", "L7"]],
    ["comp-1-x-2-2", ["R5", "R7"]],
  ]);
  private static readonly _nameCounters = new Map<string, number>();

  private _hostRef = inject(ElementRef);
  private _colorService = inject(ColorService);
  private _dirtyCheckColoringService = inject(DirtyCheckColoringService);
  private _cd = inject(ChangeDetectorRef);
  private _zone = inject(NgZone);
  private _warningService = inject(WarningService);
  private _stateService = inject(StateService);
  protected signal = signal(0);

  constructor(
    public name: string,
    private _level: number,
    cdStrategy: ChangeDetectionStrategy,
  ) {
    this.cdStrategyName = ChangeDetectionStrategy[cdStrategy];

    const count = AbstractChangeDetectionComponent._nameCounters.get(name) || 0;
    const titles = AbstractChangeDetectionComponent._titleMap.get(name);
    this.title = titles?.[count] ?? name;
    AbstractChangeDetectionComponent._nameCounters.set(name, count + 1);

    this._stateService.state$.pipe(takeUntilDestroyed()).subscribe((force) => {
      const cdStatus = this.getCdStatus(this._cd);
      if (cdStatus || force) {
        if (this.isStatusVisible(cdStatus)) {
          this._ngMarked.nativeElement.innerHTML = cdStatus;
          this._ngMarked.nativeElement.className = "";
          this._ngMarked.nativeElement.classList.add("tag", cdStatus?.replace(" ", "-"));
        } else {
          this._ngMarked.nativeElement.innerHTML = "";
          this._ngMarked.nativeElement.className = "";
        }
      }
    });

    this._stateService.clearFlags$.pipe(takeUntilDestroyed()).subscribe(() => {
      this._ngMarked.nativeElement.innerHTML = "";
      this._ngMarked.nativeElement.className = "";
    });
  }

  public ngAfterViewInit(): void {
    // install outside Angular zone to not trigger change detection
    this._zone.runOutsideAngular(() => {
      this._dirtyCheckColoringService.busy$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((busy) => {
        this._actionSelect.nativeElement.disabled = busy;
        this._executeButton.nativeElement.disabled = busy;
        if (!busy) {
          this._stateService.updateState(true);
        }
      });

      // Signal change
      fromEvent(this._executeButton.nativeElement, "click")
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          tap(() => this._dirtyCheckColoringService.clearColoring()),
        )
        .subscribe(() => {
          const action = this._actionSelect.nativeElement.value;
          switch (action) {
            case "click":
              // we click on the hidden button to trigger a
              // template binding event
              this._hiddenButton.nativeElement.click();
              break;
            case "detach":
              this.onDetach();
              break;
            case "attach":
              this.onAttach();
              break;
            case "dc":
              this.onDetectChanges();
              break;
            case "mfc":
              this.onMarkForCheck();
              break;
            case "signal":
              this.onSignal();
              break;
          }
          if (action != "click") {
            this._stateService.updateState();
          }
        });
    });
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes.inputObservable) {
      this._destroyInputObservable$.next();
      this.inputObservable
        .pipe(takeUntilDestroyed(this.destroyRef), takeUntil(this._destroyInputObservable$))
        .subscribe((value) => (this.inputObservableValue = value));
    }
    this._colorService.colorNgOnChanges(this._ngOnChangesBox);
  }

  public get touch(): void {
    return this._colorService.colorDirtyCheck(this._hostRef);
  }

  public onClick(): void {
    this._warningService.hideWarning();
    this._stateService.updateState();
    console.log(`Click for ${this.name}`);
  }

  private onDetectChanges(): void {
    console.log(`ChangeDetectorRef.detectChanges() for ${this.name}`);
    this._cd.detectChanges();
  }

  private onMarkForCheck(): void {
    console.log(`ChangeDetectorRef.markForCheck() for ${this.name}`);
    this._cd.markForCheck();
  }

  private onDetach(): void {
    console.log(`ChangeDetectorRef.detach() for ${this.name}`);
    this._cd.detach();
    this._colorService.colorChangeDetectorDetached(this._cdStateBox);
  }

  private onAttach(): void {
    console.log(`ChangeDetectorRef.reattach() for ${this.name}`);
    this._cd.reattach();
    this._colorService.colorChangeDetectorAttached(this._cdStateBox);
  }

  private onSignal(): void {
    this.signal.update((v) => v + 1);
  }

  private isStatusVisible(status: CdStatus): boolean {
    if (!status) return false;
    return this._stateService.showFlags;
  }

  private getCdStatus(cdRef: ChangeDetectorRef): CdStatus {
    let lView = (cdRef as any)._lView;
    const flags: number = lView[2]; // FLAGS=2
    const consumer = lView[23]; // REACTIVE_TEMPLATE_CONSUMER =  23

    if (flags & 64) {
      // LViewFlags.Dirty = 1 << 6 = 64
      return "dirty";
    } else if (flags & 8192) {
      // LViewFlags.HasChildViewsToRefresh = 8192
      return "HasChildViewsToRefresh";
    } else if (flags & 1024) {
      return "RefreshView";
    } else if (consumer.dirty) {
      return "Consumer dirty";
    } else {
      return null;
    }
  }
}

type CdStatus = "HasChildViewsToRefresh" | "RefreshView" | "dirty" | "Consumer dirty" | null;

@Injectable({ providedIn: "root" })
export class StateService {
  private _state = new Subject<boolean>();
  private _showFlags = new BehaviorSubject<boolean>(true);
  private _clearFlags = new Subject<void>();

  public get state$(): Observable<boolean> {
    return this._state.asObservable();
  }

  public get clearFlags$(): Observable<void> {
    return this._clearFlags.asObservable();
  }

  public get showFlags(): boolean {
    return this._showFlags.value;
  }

  public toggleFlags(): void {
    this._showFlags.next(!this._showFlags.value);
    this.updateState(true);
  }

  public clearFlags(): void {
    this._clearFlags.next();
  }

  public updateState(cleanup = false): void {
    this._state.next(cleanup);
  }
}
