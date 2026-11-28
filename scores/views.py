from .i18n import tr
from django.conf import settings
from django.contrib import messages
from django.db.models import F
from django.http import FileResponse, Http404, HttpResponse, HttpResponseForbidden
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_http_methods

from .forms import ScoreEditForm, ScoreUploadForm
from .models import Score, SiteVisit
from .google_auth import can_manage_scores


@require_http_methods(["GET", "POST"])
def score_list(request, mobile=False, management=False):
    show_upload = can_manage_scores(request) and (
        management or not getattr(settings, "PUBLIC_SCORE_VIEW", False))
    if (management and not can_manage_scores(request)) or (request.method == "POST" and not show_upload):
        return HttpResponseForbidden(tr("악보 관리 권한이 없습니다."))
    form = ScoreUploadForm(request.POST or None, request.FILES or None)
    if request.method == "POST" and form.is_valid():
        score = form.save()
        messages.success(request, tr("'%(title)s' 악보를 등록했습니다.") % {"title": score.title})
        return redirect("scores:mobile-detail" if mobile else "scores:detail", pk=score.pk)
    visits, _ = SiteVisit.objects.get_or_create(pk=1)
    if request.method == "GET" and not management:
        SiteVisit.objects.filter(pk=visits.pk).update(visit_count=F("visit_count") + 1)
        visits.refresh_from_db()
    return render(request, "scores/score_list.html", {"visit_count": visits.visit_count, "scores": Score.objects.all(), "form": form, "show_upload": show_upload, "mobile": mobile, "detail_route": "scores:mobile-detail" if mobile else "scores:detail"})


def score_detail(request, pk, mobile=False):
    score = get_object_or_404(Score, pk=pk)
    if request.method == "GET":
        Score.objects.filter(pk=score.pk).update(visit_count=F("visit_count") + 1)
        score.refresh_from_db()
    return render(request, "scores/score_detail.html", {"score": score, "mobile": mobile})


@require_http_methods(["GET", "POST"])
def score_edit(request, pk):
    if not can_manage_scores(request):
        return HttpResponseForbidden(tr("악보 관리 권한이 없습니다."))
    score = get_object_or_404(Score, pk=pk)
    form = ScoreEditForm(request.POST or None, instance=score)
    if request.method == "POST" and form.is_valid():
        score = form.save()
        messages.success(request, tr("악보와 타이틀을 저장했습니다."))
        return redirect("scores:detail", pk=score.pk)
    if request.method == "POST":
        messages.error(request, tr("변경 사항을 저장하지 못했습니다. 아래 오류 내용을 확인해 주세요."))
    return render(request, "scores/score_edit.html", {"score": score, "form": form})


def score_musicxml(request, pk):
    score = get_object_or_404(Score, pk=pk)
    return HttpResponse(score.xml_content, content_type="application/vnd.recordare.musicxml+xml; charset=utf-8")


@require_http_methods(["GET", "POST"])
def score_delete(request, pk):
    if not can_manage_scores(request):
        return HttpResponseForbidden(tr("악보 관리 권한이 없습니다."))
    score = get_object_or_404(Score, pk=pk)
    if request.method == "POST":
        title = score.title
        score.delete()
        messages.success(request, tr("'%(title)s' 악보를 삭제했습니다.") % {"title": title})
        return redirect("scores:list")
    return render(request, "scores/score_confirm_delete.html", {"score": score})


@require_http_methods(["GET"])
def score_pdf(request, pk):
    score = get_object_or_404(Score, pk=pk)
    path = score.pdf_path
    if path is None:
        raise Http404("PDF not found")
    try:
        stream = path.open("rb")
    except FileNotFoundError:
        raise Http404("PDF not found")
    return FileResponse(stream, as_attachment=True, filename=path.name, content_type="application/pdf")
