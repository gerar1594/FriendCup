import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from '../../services/loading/loading.service';

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loadingService = inject(LoadingService);
  
  loadingService.show(req.url); // Pasamos la URL

  return next(req).pipe(
    finalize(() => loadingService.hide(req.url)) // Pasamos la URL
  );
};