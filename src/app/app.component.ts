import {
  AfterViewInit,
  ApplicationRef,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  NgZone,
  OnInit, signal,
  VERSION,
  ViewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { toCanvas } from "qrcode";
import { Subject } from "rxjs";

import { StateService } from "./abstract-change-detection.component";
import { DirtyCheckColoringService } from "./dirty-check-coloring.service";
import { NumberHolder } from "./number-holder";
import { WarningService } from "./warning.service";

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
  standalone: false,
})
export class AppComponent implements OnInit, AfterViewInit {
  protected version = VERSION.full
  private destroyRef = inject(DestroyRef);

  private value = 0;
  public inputByVal!: number;
  public inputByRef = new NumberHolder();
  public inputObservable = new Subject<number>();
  protected readonly showCommonOptions = signal<boolean>(false);


  @ViewChild("apptick_button", { static: true }) private _apptickButton!: ElementRef;

  @ViewChild("timeout_button", { static: true }) private _timeoutButton!: ElementRef;

  @ViewChild("click_button", { static: true }) private _clickButton!: ElementRef;

  @ViewChild("trigger_change", { static: true }) private _triggerChangeButton!: ElementRef;

  @ViewChild("clear", { static: true }) private _clearButton!: ElementRef;

  @ViewChild("auto_clear", { static: true })
  private _autoClearCheckbox!: ElementRef<HTMLInputElement>;

  @ViewChild("toggle_content_children", { static: true })
  private _toggleContentChildren!: ElementRef<HTMLElement>;

  @ViewChild("input_value_field", { static: true })
  private _inputValueField!: ElementRef<HTMLElement>;

  @ViewChild("propagate_by_value_checkbox", { static: true })
  private _propagateByValueCheckbox!: ElementRef<HTMLInputElement>;

  @ViewChild("propagate_by_ref_checkbox", { static: true })
  private _propagateByRefCheckbox!: ElementRef<HTMLInputElement>;

  @ViewChild("propagate_by_observable_checkbox", { static: true })
  private _propagateByObservableCheckbox!: ElementRef<HTMLInputElement>;

  @ViewChild("propagate_in_zone_checkbox", { static: true })
  private _propagateInZoneCheckbox!: ElementRef<HTMLInputElement>;

  @ViewChild("qrcode_canvas", { static: true }) private _canvas!: ElementRef<HTMLCanvasElement>;

  @ViewChild("flag_toggle", { static: true })
  private _flagToggleButton!: ElementRef<HTMLButtonElement>;

  private _stateService = inject(StateService);

  constructor(
    private _zone: NgZone,
    private _appRef: ApplicationRef,
    private _dirtyCheckColoringService: DirtyCheckColoringService,
    private _warningService: WarningService,
  ) {}

  ngOnInit(): void {
    var canvas = document.getElementById("canvas");

    toCanvas(this._canvas.nativeElement, window.location.href, function (error) {
      if (error) console.error(error);
      console.log("success!");
    });
  }

  onTick() {
    this._dirtyCheckColoringService.clearColoring();
    this._appRef.tick();
    this._warningService.hideWarning();
  }

  onTimeout() {
    setTimeout(() => {
      this._warningService.hideWarning();
      this._zone.run(() => console.log(`setTimeout(...)`));
    }, 3000);
  }

  onClear() {
    this._warningService.hideWarning();
    this._dirtyCheckColoringService.clearColoring();
  }

  clickNoop(): void {
    console.log(`click`);
  }

  onAutoCheckboxChange(event: Event) {
    const element = event.target as HTMLInputElement;
    this._dirtyCheckColoringService.setAutoClearColoring(element.checked);
  }

  onChange() {
    this._dirtyCheckColoringService.clearColoring();
    if (this.isPropagateInZone()) {
      this._zone.run(() => this.updateInputValue());
    } else {
      this.updateInputValue();
    }
  }

  public ngAfterViewInit(): void {
    this._dirtyCheckColoringService.setAutoClearColoring(this.isAutoClear());

    // Busy
    this._dirtyCheckColoringService.busy$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((busy) => {
      this._apptickButton.nativeElement.disabled = busy;
      this._timeoutButton.nativeElement.disabled = busy;
      this._clickButton.nativeElement.disabled = busy;
      this._autoClearCheckbox.nativeElement.disabled = busy;
      this._triggerChangeButton.nativeElement.disabled = busy;
      this._propagateByValueCheckbox.nativeElement.disabled = busy;
      this._propagateByRefCheckbox.nativeElement.disabled = busy;
      this._propagateByObservableCheckbox.nativeElement.disabled = busy;
      this._propagateInZoneCheckbox.nativeElement.disabled = busy;
      if (busy && !this._dirtyCheckColoringService.isAutoClearColoring) {
        this._clearButton.nativeElement.classList.add("emphasize");
      } else {
        this._clearButton.nativeElement.classList.remove("emphasize");
      }
    });
  }


  private updateInputValue(): void {
    this.value++;
    if (this.isPropagateByValue()) {
      this.inputByVal = this.value;
    }
    if (this.isPropagateByRef()) {
      this.inputByRef.value = this.value;
    }
    if (this.isPropagateByObservable()) {
      this.inputObservable.next(this.value);
    }

    // Update DOM directly because outside Angular zone to not trigger change
    // detection
    const valueElement = this._inputValueField.nativeElement;
    valueElement.innerHTML = this.value.toString(10);
  }

  private isAutoClear(): boolean {
    return this._autoClearCheckbox.nativeElement.checked;
  }

  private isPropagateByValue(): boolean {
    return this._propagateByValueCheckbox.nativeElement.checked;
  }

  private isPropagateByRef(): boolean {
    return this._propagateByRefCheckbox.nativeElement.checked;
  }

  private isPropagateByObservable(): boolean {
    return this._propagateByObservableCheckbox.nativeElement.checked;
  }

  private isPropagateInZone(): boolean {
    return this._propagateInZoneCheckbox.nativeElement.checked;
  }

  onToggleFlags(): void {
    this._stateService.toggleFlags();
    const btn = this._flagToggleButton.nativeElement;
    if (this._stateService.showFlags) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  }

  onClearFlags(): void {
    this._stateService.clearFlags();
  }

  public toggleCommonOptions(): void {
    this.showCommonOptions.set(!this.showCommonOptions())
  }
}
