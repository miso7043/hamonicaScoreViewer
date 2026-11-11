# MusicXML 악보함

Django와 SQLite로 MusicXML 악보를 저장하고 브라우저에서 일반 악보처럼 열람·수정하는 웹앱입니다. 악보 렌더링에는 Verovio WebAssembly CDN을 사용합니다.

기본 화면의 악보는 한 줄에 4마디씩, `/m` 모바일 화면에서는 한 줄에 2마디씩 표시됩니다. 이 줄바꿈은 렌더링할 때만 적용되므로 DB에 저장된 원본 MusicXML은 변경되지 않습니다.

악보 위의 **재생** 버튼을 누르면 MusicXML의 음높이, 음표 길이, 쉼표, 화음과 템포를 읽어 `snd/note_snd/`의 M4A 하모니카 녹음 음원으로 연주합니다. 같은 음높이의 붙임줄(`tie` 또는 `notations/tied`)은 길이를 합쳐 한 번만 발음하며, 다른 음높이는 각각 연주합니다. 도돌이표와 1·2번 괄호를 반영해 첫 회에는 1번, 반복 후에는 2번을 연주합니다. 악보의 음표를 클릭하면 해당 음표부터 바로 재생하며, 재생 중에도 클릭한 위치로 이동합니다. 샘플에 없는 반음과 음역은 가장 가까운 샘플의 피치를 조절하여 재생합니다.

## 실행

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

브라우저에서 <http://127.0.0.1:8000>을 엽니다. `.xml` 또는 `.musicxml` 파일을 올리면 XML 원문과 제목·작곡가가 SQLite에 저장됩니다. `musicXML/`의 예제는 자동 등록되지 않으므로 필요한 파일을 직접 업로드하세요.

## 수정 기능

- 악보 화면의 **타이틀·악보 수정**에서 제목, 작곡가, MusicXML 원문을 편집할 수 있습니다.
- **변경 내용 미리보기**는 저장 전 XML을 Verovio로 렌더링합니다.
- 저장 시 XML 문법과 MusicXML 루트를 검사합니다.
- 제목을 저장하면 XML의 `<work-title>`도 같은 값으로 수정됩니다. 요소가 없으면 `<work>`와 함께 추가됩니다.
- 반대로 XML 편집기에서 `<work-title>`만 수정하면 DB의 제목도 XML 값으로 변경됩니다. 두 곳을 동시에 수정하면 제목 입력란의 값이 우선합니다.
- 목록 또는 악보 상세 화면에서 **삭제**를 누른 뒤 확인하면 DB에서 악보를 삭제할 수 있습니다.

렌더러는 CDN에서 내려받으므로 악보 표시와 미리보기에는 인터넷 연결이 필요합니다. XML 업로드 한도는 10MB입니다.

## 테스트

```bash
python manage.py test
```

## 하모니카 음원

재생에는 `snd/note_snd/`에 있는 M4A 음원 24개를 사용합니다. 파일명에 표시된 음높이를 MIDI 음으로 매핑하고, 샘플에 없는 음은 가장 가까운 샘플의 재생 속도를 조절해 연주합니다. 긴 음은 1.04초부터 최대 3초까지의 지속 구간을 반복합니다.

## 모바일 화면

`/m` 또는 `/m/`에서 모바일 대시보드를 열 수 있습니다. 목록에서 악보를 선택하면 `/m/scores/<번호>/`에서 두 마디씩 표시하며, 재생과 페이지 이동을 사용할 수 있습니다. 모바일에서 업로드한 악보도 모바일 화면으로 열립니다.

휴대폰과 서버 PC를 같은 Wi-Fi에 연결하고, PC의 실제 내부 IP를 아래 예시의 IP 대신 넣어 실행하세요.

```bash
DJANGO_ALLOWED_HOSTS=192.168.0.10 python manage.py runserver 0.0.0.0:8000
```

휴대폰 브라우저에서 `http://192.168.0.10:8000/m`으로 접속합니다. PC 방화벽에서 8000 포트 연결이 허용되어 있어야 합니다. 이 실행 방식은 로컬 개발용입니다.

## VPS 배포 구성

운영 설정은 `config.production`이며 구글 OAuth로 허용된 숫자 계정 ID 하나만 인증합니다. 인증은 Authlib의 OpenID Connect 검증을 사용합니다. 관련 규약은 [Google OpenID Connect 문서](https://developers.google.com/identity/openid-connect/openid-connect)를 참고하세요.

- 예정 PC 주소: `https://scores.example.com/harmonica/`
- 예정 모바일 주소: `https://scores.example.com/harmonica/m`
- 앱: `/opt/hamonica-player`, DB: `/var/lib/hamonica-player/db.sqlite3`
- 서비스: `deploy/hamonica-player.service`, 내부 포트: `127.0.0.1:8030`
- 운영 환경변수: `DJANGO_SETTINGS_MODULE=config.production`, `DJANGO_SECRET_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_GOOGLE_ID`
- Nginx: `deploy/hamonica-nginx.conf`를 기존 HTTPS 서버에 include하고, http 블록에서 `$arg_state`가 `~^hmp_`이면 `127.0.0.1:8030`, 나머지는 `127.0.0.1:8020`으로 보내는 `$hamonica_callback_backend` map을 정의합니다.
- 구글 콜백은 기존 등록 주소 `/auth/google/callback`을 재사용합니다. 세션 쿠키 이름은 `hamonica_session`입니다.

현재 소스와 배포 설정은 준비되어 있으며, VPS로의 파일 전송과 서비스 활성화는 아직 완료되지 않았습니다. 서버에 별도 검증용 Python 가상환경을 준비했습니다.
