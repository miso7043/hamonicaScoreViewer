"""Interface translations; score titles and MusicXML content remain user data."""
from html import unescape
from django.utils.translation import get_language

TRANSLATIONS = {"로그아웃": "Log out",
 "'%(title)s' 악보를 등록했습니다.": "Score '%(title)s' added.",
 "'%(title)s' 악보를 삭제했습니다.": "Score '%(title)s' deleted.",
 '.xml 또는 .musicxml 파일을 선택해 주세요.': 'Choose an .xml or .musicxml file.',
 '.xml, .musicxml · 최대 10MB': '.xml, .musicxml · Up to 10MB',
 '24홀 복음 하모니카': '24-hole tremolo harmonica',
 'C조 24홀 복음 하모니카 운지 안내': 'Fingering guide for a 24-hole C tremolo harmonica',
 'MusicXML 루트 요소를 찾을 수 없습니다.': 'Cannot find the MusicXML root element.',
 'MusicXML 문법 오류': 'Invalid MusicXML syntax',
 'MusicXML 문법이 올바르지 않습니다.': 'Invalid MusicXML syntax.',
 'MusicXML 악보함': 'MusicXML Library',
 'MusicXML 업로드': 'Upload MusicXML',
 'MusicXML 파일': 'MusicXML file',
 'MusicXML(score-partwise 또는 score-timewise) 파일만 사용할 수 있습니다.': 'Only MusicXML '
                                                               '(score-partwise '
                                                               'or '
                                                               'score-timewise) '
                                                               'files are '
                                                               'supported.',
 'MusicXML로 구성된 악보.': 'Sheet music in MusicXML format.',
 'Verovio CDN을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.': 'Could not load Verovio. Check '
                                              'your internet connection.',
 'Verovio가 MusicXML을 읽지 못했습니다.': 'Verovio could not read the MusicXML.',
 'XML 문자 인코딩을 읽을 수 없습니다.': 'Cannot read the XML character encoding.',
 'XML 수정': 'Edit XML',
 'Ⅱ 일시정지': 'Ⅱ Pause',
 '← 악보 목록': '← Score list',
 '← 악보로 돌아가기': '← Back to score',
 '■ 처음으로': '■ Reset',
 '▶ 계속': '▶ Resume',
 '▶ 다시 재생': '▶ Replay',
 '▶ 재생': '▶ Play',
 '곡': ' scores',
 '구글 인증에 실패했습니다. 다시 로그인해 주세요.': 'Google authentication failed. Please sign in '
                                'again.',
 '다음 페이지': 'Next page',
 '도돌이표 반복 횟수가 너무 많습니다.': 'Too many repeat iterations.',
 '미리보기': 'Preview',
 '변경 내용 미리보기': 'Preview changes',
 '변경 사항 저장': 'Save changes',
 '변경 사항을 저장하지 못했습니다. 아래 오류 내용을 확인해 주세요.': 'Could not save changes. Check the '
                                          'errors below.',
 '삭제': 'Delete',
 '삭제한 악보는 복구할 수 없습니다.': 'Deleted scores cannot be recovered.',
 '수정': 'Updated',
 '아직 저장된 악보가 없습니다.': 'No scores saved yet.',
 '악보 (스크롤하여 전체 보기)': 'Score (scroll to view all)',
 '악보 관리 권한이 없습니다.': 'You do not have permission to manage scores.',
 '악보 등록': 'Add score',
 '악보 렌더러를 불러오는 중입니다…': 'Loading score renderer…',
 '악보 보기': 'View score',
 '악보 삭제': 'Delete score',
 '악보를 만드는 중입니다…': 'Rendering score…',
 '악보를 삭제할까요?': 'Delete this score?',
 '악보와 타이틀을 저장했습니다.': 'Score and title saved.',
 '올바른 XML이 아닙니다: %(error)s': 'Invalid XML: %(error)s',
 '위에서 MusicXML 파일을 등록해 주세요.': 'Upload a MusicXML file above.',
 '음원 로드 실패': 'Failed to load audio sample',
 '의 XML 데이터가 DB에서 영구적으로 삭제됩니다.': ' XML data will be permanently deleted from '
                                 'the database.',
 '이전 페이지': 'Previous page',
 '인증된 이메일이 있는 구글 계정으로 로그인해 주세요.': 'Sign in with a Google account with a '
                                  'verified email.',
 '작곡가': 'Composer',
 '작곡가 미상': 'Unknown composer',
 '재생 준비': 'Ready to play',
 '재생할 음표가 없습니다': 'No notes to play',
 '저장된 악보': 'Saved scores',
 '저장할 수 없는 내용이 있습니다.': 'Some fields could not be saved.',
 '제목': 'Title',
 '취소': 'Cancel',
 '타이틀·악보 수정': 'Edit title and score',
 '타이틀을 저장하면 XML의 &lt;work-title&gt;도 함께 변경됩니다.': 'Saving the title also '
                                                 'updates &lt;work-title&gt; '
                                                 'in the XML.',
 '태화니 악보 리스트': 'Taehwani’s Score Library',
 '파일 크기는 10MB 이하여야 합니다.': 'The file must be 10MB or smaller.',
 '표시된 항목을 수정한 뒤 다시 저장해 주세요. 올바른 MusicXML 형식이어야 합니다.': 'Correct the highlighted '
                                                      'fields and save again. '
                                                      'The score must be valid '
                                                      'MusicXML.',
 '하모니카 음원을 불러오는 중…': 'Loading harmonica samples…'}

def tr(message):
    return unescape(message if (get_language() or "ko").split("-")[0] == "ko" else TRANSLATIONS.get(message, message))
