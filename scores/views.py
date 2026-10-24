from django.contrib import messages
from django.http import HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_http_methods

from .forms import ScoreEditForm, ScoreUploadForm
from .models import Score


@require_http_methods(["GET", "POST"])
def score_list(request, mobile=False):
    form = ScoreUploadForm(request.POST or None, request.FILES or None)
    if request.method == "POST" and form.is_valid():
        score = form.save()
        messages.success(request, f"'{score.title}' 악보를 등록했습니다.")
        return redirect("scores:mobile-detail" if mobile else "scores:detail", pk=score.pk)
    return render(request, "scores/score_list.html", {"scores": Score.objects.all(), "form": form, "mobile": mobile, "detail_route": "scores:mobile-detail" if mobile else "scores:detail"})


def score_detail(request, pk, mobile=False):
    return render(request, "scores/score_detail.html", {"score": get_object_or_404(Score, pk=pk), "mobile": mobile})


@require_http_methods(["GET", "POST"])
def score_edit(request, pk):
    score = get_object_or_404(Score, pk=pk)
    form = ScoreEditForm(request.POST or None, instance=score)
    if request.method == "POST" and form.is_valid():
        score = form.save()
        messages.success(request, "악보와 타이틀을 저장했습니다.")
        return redirect("scores:detail", pk=score.pk)
    if request.method == "POST":
        messages.error(request, "변경 사항을 저장하지 못했습니다. 아래 오류 내용을 확인해 주세요.")
    return render(request, "scores/score_edit.html", {"score": score, "form": form})


def score_musicxml(request, pk):
    score = get_object_or_404(Score, pk=pk)
    return HttpResponse(score.xml_content, content_type="application/vnd.recordare.musicxml+xml; charset=utf-8")


@require_http_methods(["GET", "POST"])
def score_delete(request, pk):
    score = get_object_or_404(Score, pk=pk)
    if request.method == "POST":
        title = score.title
        score.delete()
        messages.success(request, f"'{title}' 악보를 삭제했습니다.")
        return redirect("scores:list")
    return render(request, "scores/score_confirm_delete.html", {"score": score})
