import { ElementRef, Injectable, NgZone } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";
import { delay, distinctUntilChanged, filter, switchMap, take } from "rxjs/operators";
import { DelayedScheduler } from "./delayed-scheduler.service";

/**
 * Controls coloring of dirty checked components.
 */
@Injectable({ providedIn: "root" })
export class DirtyCheckColoringService {
  private _clearGeneration$ = new BehaviorSubject<number>(0);
  private _autoClearColoring = true;
  private _busy$ = new BehaviorSubject<boolean>(false);

  get isAutoClearColoring(): boolean {
    return this._autoClearColoring;
  }

  constructor(
    private _zone: NgZone,
    private _delayedScheduler: DelayedScheduler,
  ) {}

  public clearColoring(): void {
    this._clearGeneration$.next(this._clearGeneration$.value + 1);
  }

  public setAutoClearColoring(autoClear: boolean): void {
    this._autoClearColoring = autoClear;
    if (autoClear) {
      this.clearColoring();
    }
  }

  public colorDirtyCheck(elementRef: ElementRef<HTMLElement>): void {
    this._busy$.next(true);
    this._zone.runOutsideAngular(() => {
      const element = elementRef.nativeElement;
      const cssClass = "dirty-check";
      const startGen = this._clearGeneration$.value;
      this._delayedScheduler.schedule(() => {
        element.classList.add(cssClass);
      });

      if (this._autoClearColoring) {
        this._delayedScheduler.done$
          .pipe(
            take(1), // subscribe once
            delay(1000), // clear after 1s
          )
          .subscribe(() => {
            element.classList.remove(cssClass);
            this._busy$.next(false);
          });
      } else {
        this._delayedScheduler.done$
          .pipe(
            take(1), // subscribe once
            switchMap(() =>
              this._clearGeneration$.pipe(
                filter((gen) => gen > startGen),
                take(1),
              ),
            ),
          )
          .subscribe(() => {
            element.classList.remove(cssClass);
            this._busy$.next(false);
          });
      }
    });
  }

  public get busy$(): Observable<boolean> {
    return this._busy$.asObservable().pipe(distinctUntilChanged());
  }
}
